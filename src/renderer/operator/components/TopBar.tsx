import { useOperator } from '../store'
import { AlertIcon, FolderIcon, PlusIcon } from './icons'

export function TopBar() {
  const outputMode = useOperator((s) => s.outputMode)
  const setOutputMode = useOperator((s) => s.setOutputMode)
  const blankMode = useOperator((s) => s.blankMode)
  const clearOn = useOperator((s) => s.clearOn)
  const outputVisible = useOperator((s) => s.outputVisible)
  const toggleBlank = useOperator((s) => s.toggleBlank)
  const toggleClear = useOperator((s) => s.toggleClear)
  const toggleOutputVisibility = useOperator((s) => s.toggleOutputVisibility)
  const setAlertsOpen = useOperator((s) => s.setAlertsOpen)

  return (
    <div className="topbar">
      <div className="tb-cluster">
        <div className="tb-icon" title="New schedule">
          <PlusIcon />
        </div>
        <div className="tb-icon" title="Open schedule">
          <FolderIcon />
        </div>
        <div className="tb-divider"></div>
        <div className="app-title">
          Scripture Caster <span>· Sunday Service</span>
        </div>
      </div>

      <div className="tb-cluster">
        <span
          style={{
            fontSize: '11px',
            color: 'var(--text-lo)',
            fontWeight: 600,
            letterSpacing: '0.4px',
          }}
        >
          OUTPUT
        </span>
        <div className="segmented-sm">
          <button
            className={outputMode === 'combined' ? 'on' : ''}
            onClick={() => setOutputMode('combined')}
          >
            Combined
          </button>
          <button
            className={outputMode === 'split' ? 'on' : ''}
            onClick={() => setOutputMode('split')}
          >
            Split screens
          </button>
        </div>
        <div className="tb-divider"></div>
        <div className="session-chip">
          <div className="dot-pulse"></div>
          34:12
        </div>
      </div>

      <div className="tb-cluster">
        <div className="alerts-btn" onClick={() => setAlertsOpen(true)}>
          <AlertIcon />
          Alerts
        </div>
        <div className="lbc-cluster">
          <div
            className={'lbc-btn' + (blankMode === 'logo' ? ' active' : '')}
            onClick={() => toggleBlank('logo')}
          >
            LOGO
          </div>
          <div
            className={'lbc-btn' + (blankMode === 'black' ? ' active' : '')}
            onClick={() => toggleBlank('black')}
          >
            BLACK
          </div>
          <div className={'lbc-btn' + (clearOn ? ' active' : '')} onClick={toggleClear}>
            CLEAR
          </div>
        </div>
        <div className="tb-divider"></div>
        <button
          type="button"
          className={'live-pill' + (outputVisible ? '' : ' off')}
          onClick={toggleOutputVisibility}
        >
          <div className="rdot"></div>
          <span>{outputVisible ? 'ON AIR' : 'OFF AIR'}</span>
        </button>
      </div>
    </div>
  )
}