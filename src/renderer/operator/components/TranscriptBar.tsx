import type { CSSProperties } from 'react'
import { useOperator } from '../store'
import { useDeepgram } from '../hooks/useDeepgram'

function statusLabel(
  status: ReturnType<typeof useDeepgram>['status'],
  attempts: number,
): string {
  switch (status) {
    case 'initializing':
      return 'Initializing…'
    case 'listening':
      return 'Listening'
    case 'reconnecting':
      return `Reconnecting (${attempts}/10)`
    case 'offline':
      return 'Offline'
    case 'error':
      return 'Error'
    default:
      return 'Start listening'
  }
}

export function TranscriptBar() {
  const { status, reconnectAttempts, transcript, toggle } = useDeepgram()

  const dotStyle: CSSProperties = {}
  if (status === 'idle' || status === 'offline') {
    dotStyle.animation = 'none'
    dotStyle.background = 'var(--text-lo)'
  } else if (status === 'initializing' || status === 'reconnecting') {
    dotStyle.background = 'var(--gold)'
    dotStyle.animation = 'none'
  }

  return (
    <div className="transcript">
      <div className="transcript-tag" style={{ cursor: 'pointer' }} onClick={toggle}>
        <div className="dot-pulse" style={dotStyle}></div>
        <span>{statusLabel(status, reconnectAttempts)}</span>
      </div>
      <div className="transcript-text">
        {transcript || 'Click "Start listening" to begin real-time detection'}
        <span className="transcript-caret"></span>
      </div>
    </div>
  )
}