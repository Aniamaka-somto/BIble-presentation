import { useCallback } from 'react'
import { useOperator } from '../store'
import { SlideMonitor, type SlideFit } from '../../shared/slide'

export function PreviewArea() {
  const staged = useOperator((s) => s.staged)
  const stagedFit = useOperator((s) => s.stagedFit)
  const setStagedFit = useOperator((s) => s.setStagedFit)
  const goLive = useOperator((s) => s.goLive)

  const onFit = useCallback(
    (fit: SlideFit) => setStagedFit(fit),
    [setStagedFit]
  )

  const meta = staged
    ? `1920×1080 · KJV · auto-fit ${stagedFit?.size ?? ''}px${
        stagedFit?.overflow ? ' · too long, split it' : ''
      }`
    : '1920×1080 · KJV'

  return (
    <div className="preview-frame">
      <div className="preview-label-row">
        <div className="preview-tag">
          <span className="dot" />
          Preview
        </div>
        <div className={`preview-meta${stagedFit?.overflow ? ' warn' : ''}`}>{meta}</div>
      </div>
      <div className="preview-stage">
        <SlideMonitor
          className="monitor"
          slide={staged}
          emptyText="NOTHING STAGED"
          onFit={onFit}
        />
      </div>
      <div className="promote-row">
        <button
          className="promote-btn"
          onClick={goLive}
          aria-label="Go live"
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" />
          </svg>
          Go live
        </button>
      </div>
    </div>
  )
}