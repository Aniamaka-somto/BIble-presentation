import { useState } from 'react'
import { useOperator } from '../store'

export function AlertsModal() {
  const open = useOperator((s) => s.alertsOpen)
  const setOpen = useOperator((s) => s.setAlertsOpen)
  const sendAlert = useOperator((s) => s.sendAlert)
  const [text, setText] = useState('')

  if (!open) return null

  function send() {
    const txt = text.trim()
    if (!txt) return
    sendAlert(txt)
    setText('')
  }

  return (
    <div
      className="alerts-overlay show"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="alerts-modal">
        <h3>Send an alert</h3>
        <p>Shows a message banner on the live output for a few seconds.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Nursery pickup — ticket #42"
        />
        <div className="alerts-modal-actions">
          <div className="btn btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </div>
          <div className="btn" style={{ background: 'var(--blue)', color: '#fff', border: 'none' }} onClick={send}>
            Send alert
          </div>
        </div>
      </div>
    </div>
  )
}