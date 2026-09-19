import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_KEYS, SHORTCUTS, snap } from '../data'
import { useStoreApi } from '../store'
import { Btn, Card, Row, Segmented, SliderRow, Switch } from '../ui'

const TABS = [
  ['general', 'General'],
  ['audio', 'Audio and detection'],
  ['bible', 'Bible'],
  ['keys', 'Shortcuts'],
] as const

const KEY_NAMES: Record<string, string> = {
  ArrowDown: '↓',
  ArrowUp: '↑',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space',
}

export function SettingsScreen() {
  const { store, commit, setSetSlice, resetSection } = useStoreApi()
  const snapRef = useRef(snap(store.set))
  const [toast, setToast] = useState<string | null>(null)
  const [tab, setTab] = useState<string>('general')
  const [micTest, setMicTest] = useState(false)
  const [keyVisible, setKeyVisible] = useState(false)
  const [keyStatus, setKeyStatus] = useState('Not tested')
  const [meter, setMeter] = useState(0)
  const [capturing, setCapturing] = useState<string | null>(null)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1400)
  }, [])

  const g = store.set.general
  const a = store.set.audio
  const b = store.set.bible

  const stopRef = useRef(0)
  useEffect(() => {
    return () => {
      if (stopRef.current) clearInterval(stopRef.current)
    }
  }, [])

  const toggleMicTest = () => {
    if (micTest) {
      if (stopRef.current) clearInterval(stopRef.current)
      stopRef.current = 0
      setMicTest(false)
      setMeter(0)
      return
    }
    setMicTest(true)
    stopRef.current = window.setInterval(() => setMeter(18 + Math.random() * 62), 110)
  }

  const testKey = () => {
    if (!a.key.trim()) {
      setKeyStatus('No key entered')
      return
    }
    setKeyStatus('Testing…')
    window.setTimeout(() => setKeyStatus('Connected'), 700)
  }

  const cancel = () => {
    setSetSlice(snapRef.current)
    window.close()
  }
  const apply = () => {
    snapRef.current = snap(store.set)
    flash('Saved')
  }
  const ok = () => {
    snapRef.current = snap(store.set)
    window.close()
  }
  const reset = () => {
    resetSection('set')
    setCapturing(null)
  }

  const selectKey = (id: string) => {
    setCapturing(id)
  }
  const resetKeys = () => {
    setCapturing(null)
    setSetSlice({ ...store.set, keys: { ...DEFAULT_KEYS } })
  }

  useEffect(() => {
    if (!capturing) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopImmediatePropagation()
      if (e.key === 'Escape') {
        setCapturing(null)
        return
      }
      if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return
      let label = KEY_NAMES[e.key] ?? (e.key.length === 1 ? e.key.toUpperCase() : e.key)
      if (e.ctrlKey || e.metaKey) label = 'Ctrl+' + label
      if (e.altKey) label = 'Alt+' + label
      const keys = { ...store.set.keys }
      for (const k in keys) {
        if (keys[k] === label && k !== capturing) keys[k] = '—'
      }
      keys[capturing] = label
      setSetSlice({ ...store.set, keys })
      setCapturing(null)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing])

  return (
    <section className="page show" aria-label="Settings">
      <div className="page-head">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-sub">Changes are saved as you make them.</div>
        </div>
      </div>
      <div className="page-body">
        <div className="page-inner">
          <div className="set-layout">
            <nav className="set-nav" aria-label="Settings sections">
              {TABS.map(([id, label]) => (
                <button key={id} type="button" data-tab={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
            <div>
              {tab === 'general' && (
                <div className="set-section on">
                  <Card title="General">
                    <Row
                      label="Church name"
                      ctl={
                        <input
                          className="input"
                          type="text"
                          value={g.church}
                          placeholder="Your church name"
                          aria-label="Church name"
                          onChange={(e) => commit('set.general.church', e.target.value)}
                        />
                      }
                    />
                    <Row
                      label="Service name"
                      hint="Used on the stage display and in saved schedules."
                      ctl={
                        <input
                          className="input"
                          type="text"
                          value={g.service}
                          aria-label="Service name"
                          onChange={(e) => commit('set.general.service', e.target.value)}
                        />
                      }
                    />
                    <Row
                      label="Confirm before going live"
                      hint="Asks first, which helps when someone new is running the desk."
                      ctl={<Switch checked={g.confirmLive} onChange={(v) => commit('set.general.confirmLive', v)} label="Confirm before going live" />}
                    />
                    <Row
                      label="Clear live text automatically"
                      ctl={
                        <select className="select" value={g.autoClear} onChange={(e) => commit('set.general.autoClear', e.target.value)}>
                          <option value="never">Never</option>
                          <option value="30">After 30 seconds</option>
                          <option value="60">After 1 minute</option>
                          <option value="300">After 5 minutes</option>
                        </select>
                      }
                      last
                    />
                  </Card>
                </div>
              )}

              {tab === 'audio' && (
                <div className="set-section on">
                  <div className="stack">
                    <Card title="Audio input">
                      <Row
                        label="Input device"
                        ctl={
                          <select className="select" value={a.device} onChange={(e) => commit('set.audio.device', e.target.value)}>
                            <option value="x32-4">Behringer X32 · CH 4</option>
                            <option value="x32-lr">Behringer X32 · Main L/R</option>
                            <option value="usb">USB audio interface</option>
                            <option value="builtin">Built-in microphone</option>
                          </select>
                        }
                      />
                      <Row
                        label="Input level"
                        hint="Speak, or play the sermon audio, to check the signal."
                        ctl={
                          <>
                            <div className="meter">
                              <i style={{ width: `${meter}%` }} />
                            </div>
                            <Btn onClick={toggleMicTest}>{micTest ? 'Stop test' : 'Test input'}</Btn>
                          </>
                        }
                        last
                      />
                    </Card>
                    <Card title="Speech recognition" headRight={<span className="pill muted">Deepgram · streaming</span>}>
                      <Row
                        label="API key"
                        hint="Stored on this computer only."
                        ctl={
                          <>
                            <input
                              className="input"
                              id="dgKey"
                              type={keyVisible ? 'text' : 'password'}
                              value={a.key}
                              placeholder="Paste your Deepgram key"
                              autoComplete="off"
                              aria-label="Deepgram API key"
                              onChange={(e) => commit('set.audio.key', e.target.value)}
                            />
                            <Btn onClick={() => setKeyVisible((v) => !v)}>{keyVisible ? 'Hide' : 'Show'}</Btn>
                            <Btn onClick={testKey}>Test</Btn>
                            <span className="pill muted" id="keyStatus">
                              {keyStatus}
                            </span>
                          </>
                        }
                      />
                      <Row
                        label="Language"
                        ctl={
                          <select className="select" value={a.lang} onChange={(e) => commit('set.audio.lang', e.target.value)}>
                            <option value="en-US">English (US)</option>
                            <option value="en-GB">English (UK)</option>
                            <option value="en-IN">English (India)</option>
                            <option value="en-AU">English (Australia)</option>
                          </select>
                        }
                        last
                      />
                    </Card>
                    <Card title="Scripture detection">
                      <Row
                        label="Minimum confidence"
                        hint="References heard with lower confidence are ignored."
                        ctl={<SliderRow value={a.threshold} onChange={(v) => commit('set.audio.threshold', v)} min={50} max={99} step={1} unit="%" />}
                      />
                      <Row
                        label="Send detections to"
                        hint="Preview stages the verse for you. Nothing ever goes live by itself."
                        ctl={
                          <Segmented
                            value={a.mode}
                            onChange={(v) => commit('set.audio.mode', v)}
                            options={[
                              { val: 'list', label: 'Detections list' },
                              { val: 'preview', label: 'Preview' },
                            ]}
                          />
                        }
                      />
                      <Row
                        label="Keep the last"
                        hint="Older detections drop off the list."
                        ctl={<SliderRow value={a.keep} onChange={(v) => commit('set.audio.keep', v)} min={5} max={50} step={1} unit=" items" />}
                      />
                      <Row
                        label="Ignore repeats within"
                        ctl={
                          <select className="select" value={a.repeat} onChange={(e) => commit('set.audio.repeat', e.target.value)}>
                            <option value="10">10 seconds</option>
                            <option value="30">30 seconds</option>
                            <option value="60">1 minute</option>
                          </select>
                        }
                        last
                      />
                    </Card>
                  </div>
                </div>
              )}

              {tab === 'bible' && (
                <div className="set-section on">
                  <div className="stack">
                    <Card title="Translations">
                      <Row
                        label="Primary translation"
                        ctl={
                          <select className="select" value={b.primary} onChange={(e) => commit('set.bible.primary', e.target.value)}>
                            <option value="kjv">King James Version (KJV)</option>
                            <option value="bsb">Berean Standard Bible (BSB)</option>
                            <option value="asv">American Standard Version (ASV)</option>
                            <option value="net">NET Bible (NET)</option>
                          </select>
                        }
                      />
                      <Row
                        label="Also show BSB"
                        hint="Adds a block under the primary verse, each with its own reference."
                        ctl={<Switch checked={b.extra.bsb} onChange={(v) => commit('set.bible.extra.bsb', v)} label="Also show BSB" />}
                      />
                      <Row label="Also show ASV" ctl={<Switch checked={b.extra.asv} onChange={(v) => commit('set.bible.extra.asv', v)} label="Also show ASV" />} />
                      <Row label="Also show NET" ctl={<Switch checked={b.extra.net} onChange={(v) => commit('set.bible.extra.net', v)} label="Also show NET" />} />
                      <Row
                        label="Show the translation on the slide"
                        hint="Appends the abbreviation to the reference, for example GENESIS 1:3 (KJV)."
                        ctl={<Switch checked={b.showLabel} onChange={(v) => commit('set.bible.showLabel', v)} label="Show the translation on the slide" />}
                        last
                      />
                    </Card>
                    <Card
                      title="Import a translation"
                      sub="Use a licensed translation you are allowed to display."
                      headRight={<Btn onClick={() => {}}>Choose JSON file</Btn>}
                    >
                      <div className="row-hint" style={{ maxWidth: 'none', padding: '12px 4px' }}>
                        Expected format is a flat array of objects, one per verse:{' '}
                        <span className="mono" style={{ color: 'var(--text-dim)' }}>
                          {'{ "book": "Genesis", "chapter": 1, "verse": 3, "text": "…" }'}
                        </span>
                      </div>
                    </Card>
                  </div>
                </div>
              )}

              {tab === 'keys' && (
                <div className="set-section on">
                  <Card
                    title="Keyboard shortcuts"
                    sub="Click a key, then press the new one. Esc cancels."
                    headRight={<Btn onClick={resetKeys}>Reset</Btn>}
                  >
                    {SHORTCUTS.map(([id, label, hint]) => (
                      <Row
                        key={id}
                        label={label}
                        hint={hint || undefined}
                        ctl={
                          <button
                            type="button"
                            className={`kbd${capturing === id ? ' rec' : ''}`}
                            data-key={id}
                            onClick={() => selectKey(id)}
                          >
                            {capturing === id ? 'Press a key…' : store.set.keys[id]}
                          </button>
                        }
                        last={false}
                      />
                    ))}
                  </Card>
                </div>
              )}
            </div>
          </div>
          <div className="set-foot">ScriptureCaster · operator console</div>
        </div>
      </div>
      <div className="page-footer">
        <Btn onClick={reset}>Reset to defaults</Btn>
        <div className="footer-actions">
          <span className={`toast${toast ? ' show' : ''}`}>{toast ?? ''}</span>
          <Btn onClick={cancel}>Cancel</Btn>
          <Btn onClick={apply}>Apply</Btn>
          <Btn variant="primary" onClick={ok}>
            OK
          </Btn>
        </div>
      </div>
    </section>
  )
}