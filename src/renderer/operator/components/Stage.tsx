import { useEffect, useRef } from 'react'
import { useOperator, formatVerseNum, verseLabel } from '../store'
import { bgUrl } from '../api'
import { useFitStageText } from '../hooks/useFitStageText'
import { scrollCardIntoView } from '../lib/scroll'
import { BroadcastIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'
import type { BackgroundSource } from '../../../shared/types'
import type { StageVerse } from '../types'

function BgLayer({ source, className }: { source: BackgroundSource | null; className: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (source?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [source])

  if (!source) return null

  if (source.type === 'image') {
    return (
      <div
        className={className}
        style={{ backgroundImage: `url(${bgUrl(source.fileName)})` }}
      />
    )
  }

  return (
    <div className={className}>
      <video ref={videoRef} src={bgUrl(source.fileName)} muted loop playsInline autoPlay />
    </div>
  )
}

function VerseText({
  verse,
  translation,
  className,
  textRef,
}: {
  verse: StageVerse
  translation: string
  className: string
  textRef: React.RefObject<HTMLParagraphElement>
}) {
  return (
    <>
      <p ref={textRef} className={className}>
        <span className="num">{formatVerseNum(verse.n, verse.endVerse)}</span>
        {verse.text}
      </p>
      <div className={className === 'stage-verse' ? 'stage-cite' : 'split-cite'}>
        {verse.ref} · {translation}
      </div>
    </>
  )
}

export function Stage() {
  const stagedVerse = useOperator((s) => s.stagedVerse)
  const liveVerse = useOperator((s) => s.liveVerse)
  const currentTranslation = useOperator((s) => s.currentTranslation)
  const verseCount = useOperator((s) => s.verseCount)
  const isLive = useOperator((s) => s.isLive)
  const blankMode = useOperator((s) => s.blankMode)
  const outputMode = useOperator((s) => s.outputMode)
  const activeBackground = useOperator((s) => s.activeBackground)
  const pushLive = useOperator((s) => s.pushLive)
  const stepToVerse = useOperator((s) => s.stepToVerse)
  const navigateChapter = useOperator((s) => s.navigateChapter)

  const refs = useFitStageText([stagedVerse, liveVerse, outputMode])

  function prev() {
    const s = useOperator.getState()
    if (!s.stagedVerse) return
    const keys = Object.keys(s.verseData)
      .map(Number)
      .sort((a, b) => a - b)
    const idx = keys.indexOf(s.stagedVerse.n)
    if (idx > 0) {
      const target = keys[idx - 1]
      stepToVerse(target)
      scrollCardIntoView(target)
    } else {
      navigateChapter(-1).then((n) => {
        if (n) scrollCardIntoView(n)
      })
    }
  }

  function next() {
    const s = useOperator.getState()
    if (!s.stagedVerse) return
    const keys = Object.keys(s.verseData)
      .map(Number)
      .sort((a, b) => a - b)
    const idx = keys.indexOf(s.stagedVerse.n)
    if (idx < keys.length - 1) {
      const target = keys[idx + 1]
      stepToVerse(target)
      scrollCardIntoView(target)
    } else {
      navigateChapter(1).then((n) => {
        if (n) scrollCardIntoView(n)
      })
    }
  }

  function push() {
    const s = useOperator.getState()
    if (!s.stagedVerse) return
    const n = s.stagedVerse.n
    pushLive()
    scrollCardIntoView(n)
  }

  return (
    <div className={'stage-wrap' + (blankMode === 'black' ? ' blacked' : '')}>
      <div className="stage">
        <BgLayer source={activeBackground} className="stage-bg" />
        <div className="stage-head">
          <div className={'state-tag' + (isLive ? ' is-live' : '')}>
            <span className="state-dot"></span>
            {isLive ? 'LIVE — on screen now' : 'STAGED — not yet visible'}
          </div>
          <div className="stage-ref-row">
            <span className="stage-ref">{stagedVerse ? stagedVerse.ref : ''}</span>
            <span className="kjv-tag">{currentTranslation}</span>
          </div>
        </div>
        <div className="stage-body" ref={refs.stageBody}>
          {stagedVerse && (
            <VerseText
              verse={stagedVerse}
              translation={currentTranslation}
              className="stage-verse"
              textRef={refs.stageVerse}
            />
          )}
        </div>
        <div className="stage-foot">
          <div className="navctl">
            <div className="navbtn" onClick={prev}>
              <ChevronLeftIcon />
            </div>
            <span className="navlabel">{verseLabel(stagedVerse, verseCount)}</span>
            <div className="navbtn" onClick={next}>
              <ChevronRightIcon />
            </div>
          </div>
          <div className="push-actions">
            <div className="btn btn-live" onClick={push}>
              <BroadcastIcon width={13} height={13} />
              Push live
            </div>
          </div>
        </div>
      </div>

      <div className="split-stage">
        <div className="split-pane">
          <BgLayer source={activeBackground} className="split-bg" />
          <div className="split-pane-head">
            <span className="split-pane-label">Preview — next up</span>
          </div>
          <div className="split-pane-body" ref={refs.splitPreviewBody}>
            {stagedVerse && (
              <VerseText
                verse={stagedVerse}
                translation={currentTranslation}
                className="split-verse"
                textRef={refs.splitPreviewVerse}
              />
            )}
          </div>
        </div>
        <div className="split-pane live-pane">
          <BgLayer source={activeBackground} className="split-bg" />
          <div className="split-pane-head">
            <span className="split-pane-label">Live — on screen now</span>
          </div>
          <div className="split-pane-body" ref={refs.splitLiveBody}>
            {liveVerse && (
              <VerseText
                verse={liveVerse}
                translation={currentTranslation}
                className="split-verse"
                textRef={refs.splitLiveVerse}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}