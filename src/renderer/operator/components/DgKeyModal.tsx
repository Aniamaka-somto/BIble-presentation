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
    <div className="modal-overlay">
      <div className="modal box" role="dialog" aria-modal="true" aria-label="Deepgram API key">
        <h3>Deepgram API key</h3>
        <p>Needed to start real-time listening. Stored only for this session.</p>
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Paste your API key"
        />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => submit(null)}>
            Cancel
          </button>
          <button className="btn-primary" onClick={save}>
            Save &amp; start
          </button>
        </div>
      </div>
    </div>
  )
}