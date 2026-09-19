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
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div className="modal box" role="dialog" aria-modal="true" aria-label="Send an alert">
        <h3>Send an alert</h3>
        <p>Shows a message banner on the live output for a few seconds.</p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. nursery pickup — ticket #42"
        />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={send}>
            Send alert
          </button>
        </div>
      </div>
    </div>
  )
}