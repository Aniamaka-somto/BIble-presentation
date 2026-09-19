import { useCallback, useEffect, useRef } from 'react'
import { useOperator, READING_LOCK_MS } from '../store'
import { parseExplicitReferences } from '../../../lib/detection/referenceParser'
import { paraphraseScout } from '../lib/paraphrase'
import type { DetectionInput } from '../types'

const AUDIO_CONSTRAINTS: MediaStreamConstraints['audio'] = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
}

const DG_URL =
  'wss://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&interim_results=true&punctuate=true&sample_rate=48000'

const MAX_RECONNECT = 10
const UTTERANCE_SILENCE_MS = 1200

function mergeFinalText(prev: string, next: string): string {
  const a = prev.trim()
  const b = next.trim()
  if (!a) return b
  if (!b || a === b) return a
  if (b.startsWith(a)) return b
  if (a.startsWith(b)) return a
  const aWords = a.split(/\s+/)
  const bWords = b.split(/\s+/)
  const overlap = Math.min(aWords.length, bWords.length, 8)
  for (let k = overlap; k > 0; k--) {
    if (aWords.slice(-k).join(' ') === bWords.slice(0, k).join(' ')) {
      return aWords.concat(bWords.slice(k)).join(' ')
    }
  }
  return a + ' ' + b
}

function getBestMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t
  }
  return ''
}

export function useDeepgram() {
  const status = useOperator((s) => s.listeningStatus)
  const reconnectAttempts = useOperator((s) => s.reconnectAttempts)
  const setStatus = useOperator((s) => s.setListeningStatus)
  const setReconnectAttempts = useOperator((s) => s.setReconnectAttempts)

  const statusRef = useRef(status)
  statusRef.current = status

  const wsRef = useRef<WebSocket | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const meterDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const rafRef = useRef<number | null>(null)
  const attemptsRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const utteranceRef = useRef<string>('')
  const scoutTimerRef = useRef<number | null>(null)
  const chunkRef = useRef(0)

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (scoutTimerRef.current !== null) {
      clearTimeout(scoutTimerRef.current)
      scoutTimerRef.current = null
    }
    utteranceRef.current = ''
    attemptsRef.current = 0
    setReconnectAttempts(0)
    if (recorderRef.current) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.onclose = null
      wsRef.current.close()
      wsRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    analyserRef.current = null
    meterDataRef.current = null
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    useOperator.getState().setLoudness(0)
    setStatus('idle')
  }, [setStatus, setReconnectAttempts])

  const startRef = useRef<() => Promise<void>>(async () => {})
  const stopRef = useRef(stop)
  stopRef.current = stop

  const start = useCallback(async () => {
    const key = await useOperator.getState().openDgKeyPrompt()
    if (!key) {
      setStatus('idle')
      return
    }
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    setStatus('initializing')

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: AUDIO_CONSTRAINTS })
    } catch {
      setStatus('idle')
      return
    }
    streamRef.current = stream

    try {
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.55
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      analyserRef.current = analyser
      meterDataRef.current = new Uint8Array(analyser.fftSize)
      const loop = () => {
        if (!analyserRef.current || !meterDataRef.current) return
        analyserRef.current.getByteTimeDomainData(meterDataRef.current)
        const data = meterDataRef.current
        let sum = 0
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128
          sum += v * v
        }
        const rms = Math.sqrt(sum / data.length)
        const db = rms > 0.0001 ? 20 * Math.log10(rms) : -60
        useOperator.getState().setLoudness(Math.min(1, Math.max(0, (db + 60) / 60)))
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    } catch (err) {
      console.error("Loudness meter init failed", err)
    }

    const mimeType = getBestMimeType()
    const ws = new WebSocket(DG_URL, ['token', key])
    wsRef.current = ws

    ws.onopen = () => {
      let recorder: MediaRecorder
      const opts = { audioBitsPerSecond: 64000, ...(mimeType ? { mimeType } : {}) }
      try {
        recorder = new MediaRecorder(stream, opts)
      } catch (e) {
        console.error('MediaRecorder init failed, trying without mimeType', e)
        recorder = new MediaRecorder(stream, { audioBitsPerSecond: 64000 })
      }
      recorderRef.current = recorder
      recorder.addEventListener('dataavailable', (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data)
      })
      recorder.addEventListener('error', () => stopRef.current())
      recorder.start(250)
    }

    ws.onmessage = (message) => {
      const data = JSON.parse(message.data)
      const alt = data.channel?.alternatives?.[0]
      const transcript = alt?.transcript
      if (!transcript) return

      const store = useOperator.getState()
      if (!data.is_final) {
        store.updateInterim(transcript, chunkRef.current)
        return
      }

      store.updateInterim('', chunkRef.current)
      commitFinal(store, transcript, chunkRef.current)
      if (data.speech_final) chunkRef.current += 1
      utteranceRef.current = mergeFinalText(utteranceRef.current, transcript)
      const combined = utteranceRef.current

      const refs = parseExplicitReferences(transcript)
      refs.forEach((r, i) => {
        const input: DetectionInput = {
          book: r.book,
          chapter: r.chapter,
          verse: r.verse,
          snippet: transcript.trim(),
          isTop: i === 0,
          isParaphrase: false,
          translation: store.currentTranslation,
          translationName: store.currentTranslation,
        }
        store.addDetection(input)
      })

      if (scoutTimerRef.current !== null) clearTimeout(scoutTimerRef.current)
      scoutTimerRef.current = window.setTimeout(() => {
        scoutTimerRef.current = null
        const text = combined.trim()
        utteranceRef.current = ''
        if (!text) return
        const state = useOperator.getState()
        const readingLocked =
          state.lastPushAt != null && Date.now() - state.lastPushAt < READING_LOCK_MS
        const wordCount = text.split(/\s+/).length
        if (readingLocked || wordCount > 60) return
        if (parseExplicitReferences(text).length > 0) return
        if (alt.confidence < 0.7) return
        paraphraseScout(text, state.currentTranslation).then((matches) => {
          if (!matches || matches.length === 0) return
          matches.forEach((m, i) => {
            const input: DetectionInput = {
              book: m.book,
              chapter: m.chapter,
              verse: m.verse,
              endVerse: m.endVerse,
              snippet: text,
              isTop: i === 0,
              isParaphrase: true,
              score: m.score,
              translation: m.translation,
              translationName: m.translationName,
            }
            useOperator.getState().addDetection(input)
          })
        })
      }, UTTERANCE_SILENCE_MS)
    }

    ws.onerror = (err) => {
      console.error('Deepgram error', err)
    }

    ws.onclose = () => {
      console.log('Deepgram connection closed')
      scheduleReconnectRef.current()
    }

    attemptsRef.current = 0
    setReconnectAttempts(0)
    setStatus('listening')
  }, [setStatus, setReconnectAttempts])

  startRef.current = start

  const scheduleReconnect = useCallback(() => {
    const s = statusRef.current
    if (s !== 'listening' && s !== 'reconnecting') return
    if (!navigator.onLine) {
      setStatus('offline')
      return
    }
    if (attemptsRef.current >= MAX_RECONNECT) {
      console.error('Deepgram max reconnection attempts reached')
      stopRef.current()
      return
    }
    attemptsRef.current += 1
    setReconnectAttempts(attemptsRef.current)
    const delay = Math.min(1000 * Math.pow(2, attemptsRef.current - 1), 30000)
    setStatus('reconnecting')
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      startRef.current().catch(() => {})
    }, delay)
  }, [setStatus, setReconnectAttempts])

  const scheduleReconnectRef = useRef(scheduleReconnect)
  scheduleReconnectRef.current = scheduleReconnect

  useEffect(() => {
    const onOffline = () => {
      if (statusRef.current === 'idle') return
      setReconnectAttempts(0)
      setStatus('offline')
    }
    const onOnline = () => {
      if (statusRef.current === 'idle') return
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      attemptsRef.current = 0
      startRef.current().catch(() => {})
    }
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      stopRef.current()
    }
  }, [setReconnectAttempts, setStatus])

  const toggle = useCallback(() => {
    if (statusRef.current === 'idle') {
      startRef.current().catch((err: Error) => {
        alert('Could not start listening: ' + err.message)
      })
    } else {
      stopRef.current()
    }
  }, [])

  return { status, reconnectAttempts, toggle }
}

function commitFinal(
  store: ReturnType<typeof useOperator.getState>,
  text: string,
  chunk: number
) {
  const refs = parseExplicitReferences(text)
  store.commitTranscriptFinal(
    text.trim(),
    refs.map((r) => ({ book: r.book, matchedText: r.matchedText })),
    chunk
  )
}