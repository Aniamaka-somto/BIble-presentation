import { useCallback, useRef, useState } from 'react'
import { ROLE_LABEL, snap } from '../data'
import { useStoreApi, type DisplayInfo } from '../store'
import { Btn, Card, Row, Segmented, SliderRow, Switch } from '../ui'

const OUT_SEED = {
  main: { fit: 'letterbox', overscan: 0, onLoss: 'hold', onTop: true, hideCursor: true, awake: true },
  stage: { current: true, next: true, clock: true, timer: false, transcript: false },
  stream: { bg: 'transparent', layout: 'full' },
  launch: { openOutputs: true },
}
const DISPLAYS_SEED: DisplayInfo[] = [
  { id: 1, name: 'Built-in Display', w: 1920, h: 1080, hz: 60, scale: 100, role: 'console' },
  { id: 2, name: 'Projector · HDMI 1', w: 1920, h: 1080, hz: 60, scale: 100, role: 'main' },
  { id: 3, name: 'Stage Monitor · HDMI 2', w: 1280, h: 720, hz: 60, scale: 100, role: 'stage' },
]

export function OutputRouting() {
  const { store, displays, setDisplays, commit, setOutSlice } = useStoreApi()
  const outSnap = useRef(snap(store.out))
  const dispSnap = useRef(snap(displays))
  const [toast, setToast] = useState<string | null>(null)
  const [selected, setSelected] = useState(2)
  const [identifying, setIdentifying] = useState(false)
  const [testing, setTesting] = useState<Set<number>>(new Set())
  const [scanning, setScanning] = useState(false)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1400)
  }, [])

  const o = store.out

  const selectDisplay = (d: DisplayInfo) => setSelected(d.id)

  const changeRole = (id: number, role: string) => {
    setDisplays((prev) => {
      const next = snap(prev)
      if (role !== 'off') {
        for (const d of next) if (d !== next.find((x) => x.id === id) && d.role === role) d.role = 'off'
      }
      const target = next.find((x) => x.id === id)!
      target.role = role
      return next
    })
  }

  const testToggle = (id: number) => {
    setTesting((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const identify = () => {
    setIdentifying(true)
    window.setTimeout(() => setIdentifying(false), 2600)
  }
  const rescan = () => {
    setScanning(true)
    window.setTimeout(() => setScanning(false), 900)
  }

  const cancel = () => {
    setDisplays(dispSnap.current)
    setOutSlice(outSnap.current)
    window.close()
  }
  const apply = () => {
    dispSnap.current = snap(displays)
    outSnap.current = snap(store.out)
    flash('Applied')
  }
  const ok = () => {
    dispSnap.current = snap(displays)
    outSnap.current = snap(store.out)
    window.close()
  }
  const reset = () => {
    setOutSlice(snap(OUT_SEED))
    setDisplays(snap(DISPLAYS_SEED))
  }

  const rolePill = (role: string) => {
    const d = displays.find((x) => x.role === role)
    return <span className={`pill role-display${d ? '' : ' muted'}`}>{d ? d.name : 'No display assigned'}</span>
  }

  return (
    <section className="page show" aria-label="Output routing">
      <div className="page-head">
        <div>
          <div className="page-title">Output routing</div>
          <div className="page-sub">
            Choose which screen shows what. Use extended desktop, because mirrored displays would show this console to the congregation.
          </div>
        </div>
        <div className="page-head-actions">
          <Btn onClick={identify}>Identify displays</Btn>
          <Btn onClick={rescan}>{scanning ? 'Scanning…' : 'Rescan'}</Btn>
        </div>
      </div>
      <div className="page-body">
        <div className="page-inner">
          <div className="stack">
            <Card
              title="Displays"
              sub="Click a screen to select it. Only one screen can have each role."
              headRight={<span className="pill muted">{displays.length} detected</span>}
            >
              <div className="arrangement">
                {displays.map((d) => (
                  <div
                    key={d.id}
                    className={`mon${d.id === selected ? ' sel' : ''}${identifying ? ' identify' : ''}`}
                    onClick={() => selectDisplay(d)}
                  >
                    <div
                      className={`mon-screen${testing.has(d.id) ? ' pattern' : ''}`}
                      style={{
                        width: `${Math.round((d.w / 1920) * 230)}px`,
                        height: `${Math.round((d.h / 1920) * 230)}px`,
                      }}
                    >
                      <span className={`mon-role r-${d.role}`}>{ROLE_LABEL[d.role]}</span>
                      <span className="mon-num">{d.id}</span>
                    </div>
                    <div className="mon-neck" />
                    <div className="mon-base" />
                    <div className="mon-label">{d.name}</div>
                    <div className="mon-res">
                      {d.w}×{d.h}
                    </div>
                  </div>
                ))}
              </div>
              {displays.map((d) => (
                <div key={d.id} className={`disp-row${d.id === selected ? ' sel' : ''}`}>
                  <div className="disp-num">{d.id}</div>
                  <div className="disp-main">
                    <div className="disp-name">
                      {d.name}
                      {d.role === 'console' && <span className="pill muted">This window</span>}
                    </div>
                    <div className="disp-meta">
                      {d.w}×{d.h} · {d.hz} Hz · {d.scale}% scale
                    </div>
                  </div>
                  {d.role === 'console' ? (
                    <div className="disp-fixed">Operator console</div>
                  ) : (
                    <select className="select" value={d.role} aria-label={`Role for ${d.name}`} onChange={(e) => changeRole(d.id, e.target.value)}>
                      {['main', 'stage', 'stream', 'off'].map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                  {d.role === 'console' ? (
                    <span style={{ width: 1 }} />
                  ) : (
                    <Btn onClick={() => testToggle(d.id)} className={testing.has(d.id) ? 'on' : ''}>
                      {testing.has(d.id) ? 'Stop test' : 'Test pattern'}
                    </Btn>
                  )}
                </div>
              ))}
            </Card>

            <div className="roles">
              <Card title="Main output" sub="The projector or main TV." headRight={rolePill('main')}>
                <Row
                  label="Scaling"
                  hint="Letterbox keeps 16:9 and adds black bars on other screen shapes."
                  ctl={
                    <Segmented
                      value={o.main.fit}
                      onChange={(v) => commit('out.main.fit', v)}
                      options={[
                        { val: 'letterbox', label: 'Letterbox' },
                        { val: 'fill', label: 'Fill' },
                        { val: 'stretch', label: 'Stretch' },
                      ]}
                    />
                  }
                />
                <Row
                  label="Overscan margin"
                  hint="For older projectors that crop the picture edges."
                  ctl={<SliderRow value={o.main.overscan} onChange={(v) => commit('out.main.overscan', v)} min={0} max={10} step={1} unit="%" />}
                />
                <Row
                  label="If the display disconnects"
                  ctl={
                    <select className="select" value={o.main.onLoss} onChange={(e) => commit('out.main.onLoss', e.target.value)}>
                      <option value="hold">Hold the last slide</option>
                      <option value="black">Go to black</option>
                      <option value="close">Close the output</option>
                    </select>
                  }
                />
                <Row label="Always on top" ctl={<Switch checked={o.main.onTop} onChange={(v) => commit('out.main.onTop', v)} label="Always on top" />} />
                <Row
                  label="Hide the cursor"
                  ctl={<Switch checked={o.main.hideCursor} onChange={(v) => commit('out.main.hideCursor', v)} label="Hide the cursor" />}
                  last
                />
              </Card>

              <Card title="Stage display" sub="A confidence monitor for the pastor." headRight={rolePill('stage')}>
                <Row label="Current verse" ctl={<Switch checked={o.stage.current} onChange={(v) => commit('out.stage.current', v)} label="Current verse" />} />
                <Row label="Next in schedule" ctl={<Switch checked={o.stage.next} onChange={(v) => commit('out.stage.next', v)} label="Next in schedule" />} />
                <Row label="Clock" ctl={<Switch checked={o.stage.clock} onChange={(v) => commit('out.stage.clock', v)} label="Clock" />} />
                <Row label="Service timer" ctl={<Switch checked={o.stage.timer} onChange={(v) => commit('out.stage.timer', v)} label="Service timer" />} />
                <Row
                  label="Live transcript"
                  hint="Shows the last few lines of what the speaker said."
                  ctl={<Switch checked={o.stage.transcript} onChange={(v) => commit('out.stage.transcript', v)} label="Live transcript" />}
                  last
                />
              </Card>

              <Card title="Livestream" sub="A clean feed for OBS, vMix or a capture card." headRight={rolePill('stream')}>
                <Row
                  label="Background"
                  hint="Transparent lets the text sit over your camera in a browser source."
                  ctl={
                    <Segmented
                      value={o.stream.bg}
                      onChange={(v) => commit('out.stream.bg', v)}
                      options={[
                        { val: 'black', label: 'Black' },
                        { val: 'transparent', label: 'Transparent' },
                        { val: 'green', label: 'Green key' },
                      ]}
                    />
                  }
                />
                <Row
                  label="Layout"
                  hint="Lower-thirds are planned for a later release."
                  ctl={
                    <Segmented
                      value={o.stream.layout}
                      onChange={(v) => commit('out.stream.layout', v)}
                      options={[
                        { val: 'full', label: 'Full slide' },
                        { val: 'lower', label: 'Lower third · Soon', disabled: true },
                      ]}
                    />
                  }
                  last
                />
              </Card>
            </div>

            <Card title="All outputs">
              <Row
                label="Open outputs when ScriptureCaster starts"
                ctl={<Switch checked={o.launch.openOutputs} onChange={(v) => commit('out.launch.openOutputs', v)} label="Open outputs at launch" />}
              />
              <Row
                label="Keep displays awake"
                hint="Stops the screens and the computer sleeping during a service."
                ctl={<Switch checked={o.main.awake} onChange={(v) => commit('out.main.awake', v)} label="Keep displays awake" />}
                last
              />
            </Card>
          </div>
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