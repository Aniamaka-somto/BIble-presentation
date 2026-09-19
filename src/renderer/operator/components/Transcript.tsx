import { useMemo } from 'react'
import { useOperator } from '../store'
import { useDeepgram } from '../hooks/useDeepgram'
import { normalizeNumbers } from '../../../lib/detection/numbers'

interface LineRef {
  book: string
  matchedText: string
}

function normalizeToken(tok: string): string {
  return normalizeNumbers(tok.toLowerCase()).replace(/[^a-z0-9]/g, '')
}

function TranscriptText({ text, refs }: { text: string; refs: LineRef[] }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text])
  const spans = useMemo(() => {
    const marks: Array<{ start: number; end: number }> = []
    for (const ref of refs) {
      const want = ref.matchedText.split(/\s+/).filter(Boolean).map(normalizeToken)
      if (!want.length) continue
      for (let i = 0; i < tokens.length; i++) {
        if (normalizeToken(tokens[i]) !== want[0]) continue
        let k = 0
        let j = i
        while (k < want.length && j < tokens.length) {
          const n = normalizeToken(tokens[j])
          if (n) {
            if (n !== want[k]) break
            k++
          }
          j++
        }
        if (k === want.length) {
          marks.push({ start: i, end: j })
          break
        }
      }
    }
    marks.sort((a, b) => a.start - b.start)
    const out: Array<{ start: number; end: number; cls: string }> = []
    let cursor = 0
    for (const m of marks) {
      if (m.start < cursor) continue
      out.push({ start: cursor, end: m.start, cls: 'plain' })
      out.push({ start: m.start, end: m.end, cls: 'ref' })
      cursor = m.end
    }
    out.push({ start: cursor, end: tokens.length, cls: 'plain' })
    return out
  }, [tokens, refs])

  return (
    <>
      {spans.map((s, i) =>
        s.cls === 'ref' ? (
          <span className="tr-ref" key={i}>
            {tokens.slice(s.start, s.end).join('')}
          </span>
        ) : (
          tokens.slice(s.start, s.end).join('')
        )
      )}
    </>
  )
}

export function Transcript() {
  const lines = useOperator((s) => s.transcriptLines)
  const clearTranscript = useOperator((s) => s.clearTranscript)
  const { status, toggle } = useDeepgram()

  const listening = status === 'listening' || status === 'reconnecting'

  return (
    <section className="transcript">
      <div className="tr-head">
        <div>
          <div className="panel-title">Live transcript</div>
          <div className="panel-sub">DEEPGRAM · X32 CH 4</div>
        </div>
        <div className="tr-head-right">
          <div className={`vu${listening ? ' active' : ''}`} aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
          <button className="text-link" onClick={clearTranscript}>
            Clear
          </button>
        </div>
      </div>
      <div className="tr-body">
        {lines.length === 0 && (
          <p className="tr-empty">
            Start transcribing to see what is being said. Scripture references heard
            here are sent to Detections.
          </p>
        )}
        {lines.map((line) => (
          <p key={line.id} className={`tr-line${line.final ? '' : ' interim'}`}>
            <TranscriptText text={line.text} refs={line.refs} />
          </p>
        ))}
      </div>
      <div className="tr-foot">
        <button
          className={`tr-toggle${listening ? ' on' : ''}`}
          onClick={toggle}
          aria-pressed={listening}
        >
          <span className="tr-dot" />
          {listening ? 'Stop transcribing' : 'Start transcribing'}
        </button>
      </div>
    </section>
  )
}