import { useState } from 'react'
import { useOperator } from '../store'

export function DgKeyModal() {
  const open = useOperator((s) => s.dgKeyOpen)
  const submit = useOperator((s) => s.submitDgKey)
  const [key, setKey] = useState('')

  if (!open) return null

  function save() {
    const value = key.trim()
    if (!value) return
    sessionStorage.setItem('dgKey', value)
    submit(value)
  }

  return (
    <div className="alerts-overlay show">
      <div className="alerts-modal">
        <h3>Deepgram API key</h3>
        <p>Needed to start real-time listening. Stored only for this session.</p>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your API key"
          style={{
            width: '100%',
            background: 'var(--bg-1)',
            border: '1px solid var(--line)',
            borderRadius: '9px',
            color: 'var(--text-hi)',
            fontSize: '13.5px',
            padding: '11px',
            outline: 'none',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        />
        <div className="alerts-modal-actions">
          <div className="btn btn-ghost" onClick={() => submit(null)}>
            Cancel
          </div>
          <div
            className="btn"
            style={{ background: 'var(--blue)', color: '#fff', border: 'none' }}
            onClick={save}
          >
            Save &amp; start
          </div>
        </div>
      </div>
    </div>
  )
}