import { useEffect, useState } from 'react'
import { useOperator } from '../store'
import { DisplayIcon, RoutingIcon, SettingsIcon } from './icons'
import type { SettingsPage } from '../../../shared/types'

function useClock(): string {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

export function TopBar() {
  const isLive = useOperator((s) => s.isLive)
  const clock = useClock()

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">SC</div>
        <div className="brand-name">ScriptureCaster</div>
        <div className="brand-sub">OPERATOR CONSOLE</div>
      </div>
      <div className={`tally-cluster${isLive ? ' live' : ''}`}>
        <div className="tally-dot" />
        <div className="tally-label">{isLive ? 'ON AIR' : 'STANDBY'}</div>
        <div className="tally-time">{clock}</div>
      </div>
      <div className="topbar-controls">
        <button
          className="deck-btn"
          title="Display settings"
          onClick={() => window.scriptureCaster.openSettingsPage('display' as SettingsPage)}
        >
          <DisplayIcon />
        </button>
        <button
          className="deck-btn"
          title="Output routing"
          onClick={() => window.scriptureCaster.openSettingsPage('output' as SettingsPage)}
        >
          <RoutingIcon />
        </button>
        <button
          className="deck-btn"
          title="Settings"
          onClick={() => window.scriptureCaster.openSettingsPage('settings' as SettingsPage)}
        >
          <SettingsIcon />
        </button>
      </div>
    </header>
  )
}