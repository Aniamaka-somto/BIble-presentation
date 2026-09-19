import { useOperator } from '../store'
import { SlideMonitor } from '../../shared/slide'
import { verseSlide } from '../lib/slideBuild'
import type { DetectionCard } from '../types'

function LiveMonitor() {
  const monitorSlide = useOperator((s) => s.monitorSlide)
  const isLive = useOperator((s) => s.isLive)

  return (
    <div className="live-block">
      <div className="preview-tag" style={{ color: 'var(--red)' }}>
        <span className="dot" style={{ background: 'var(--red)' }} />
        Live output
      </div>
      <SlideMonitor
        className={`live-monitor${isLive ? ' on-air' : ''}`}
        slide={monitorSlide}
        emptyText="OFF AIR"
        emptyClass="live-empty"
      />
    </div>
  )
}

function DetectionCardItem({ card }: { card: DetectionCard }) {
  const setStaged = useOperator((s) => s.setStaged)
  const goLive = useOperator((s) => s.goLive)
  const slide = verseSlide(card.refStr, card.snippet)

  return (
    <div className="detect-item">
      <div className="detect-top">
        <div className="detect-ref">{card.refStr}</div>
        <div className="detect-time">{card.timeLabel}</div>
      </div>
      <div className="detect-snippet">{card.snippet}</div>
      <div className="detect-conf">
        <div className="track">
          <div className="fill" style={{ width: `${card.confPct}%` }} />
        </div>
        <div className="val">{card.confPct}% match</div>
      </div>
      <div className="detect-actions">
        <button className="pill-btn primary" onClick={() => setStaged(slide)}>
          Preview
        </button>
        <button
          className="pill-btn"
          onClick={() => {
            setStaged(slide)
            goLive()
          }}
        >
          Go live
        </button>
      </div>
    </div>
  )
}

export function RightColumn() {
  const feed = useOperator((s) => s.feed)
  const clearFeed = useOperator((s) => s.clearFeed)

  return (
    <>
      <LiveMonitor />
      <div className="detect-block">
        <div className="panel-head">
          <div>
            <div className="panel-title">Detections</div>
            <div className="panel-sub">FROM SERMON AUDIO</div>
          </div>
          <button className="text-link" onClick={clearFeed}>
            Clear
          </button>
        </div>
        <div className="detect-list">
          {feed.length === 0 && (
            <div className="detect-empty">
              References the AI hears
              <br />
              in the sermon land here.
            </div>
          )}
          {feed.map((card) => (
            <DetectionCardItem key={card.id} card={card} />
          ))}
        </div>
      </div>
    </>
  )
}