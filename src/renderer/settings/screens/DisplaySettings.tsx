import { useCallback, useRef, useState } from 'react'
import { PRESETS, FONT_CSS, snap } from '../data'
import { useStoreApi } from '../store'
import { Btn, Card, ColorInput, Row, Segmented, SliderRow, Swatches, Switch } from '../ui'
import { DisplayPreview } from '../DisplayPreview'

const TEXT_COLORS = [
  { color: '#eef3fb', label: 'Cool white' },
  { color: '#ffffff', label: 'White' },
  { color: '#f5e9c8', label: 'Cream' },
  { color: '#ffe066', label: 'Yellow' },
]

const BG_COLORS = [
  { color: '#070a11', label: 'Midnight' },
  { color: '#000000', label: 'Black' },
  { color: '#0b1f4d', label: 'Royal blue' },
  { color: '#f4efe4', label: 'Paper' },
  { color: '#00b140', label: 'Chroma green' },
]

export function DisplaySettings() {
  const { store, commit, resetSection, setDisplaySlice } = useStoreApi()
  const snapRef = useRef(snap(store.display))
  const [toast, setToast] = useState<string | null>(null)
  const [fit, setFit] = useState('')

  const d = store.display

  const flash = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 1400)
  }, [])

  const presetLock = useRef(false)

  const applyPreset = (k: string) => {
    presetLock.current = true
    setDisplaySlice({ ...PRESETS[k], preset: k })
    presetLock.current = false
  }

  const editField = (path: string, value: unknown) => {
    commit(path, value)
    if (!presetLock.current && ['display.bg', 'display.color', 'display.ref', 'display.font'].includes(path)) {
      commit('display.preset', 'custom')
    }
  }

  const onFit = useCallback((f: { size: number; overflow: boolean }) => {
    setFit(`auto-fit ${f.size}px${f.overflow ? ' · too long' : ''}`)
  }, [])

  const cancel = () => {
    setDisplaySlice(snapRef.current)
    window.close()
  }
  const apply = () => {
    snapRef.current = snap(store.display)
    flash('Applied')
  }
  const ok = () => {
    snapRef.current = snap(store.display)
    window.close()
  }
  const reset = () => {
    resetSection('display')
    presetLock.current = false
  }

  return (
    <section className="page show" aria-label="Display settings">
      <div className="page-head">
        <div>
          <div className="page-title">Display settings</div>
          <div className="page-sub">
            How scripture looks on every screen. Changes apply instantly to the preview, live monitor and outputs.
          </div>
        </div>
      </div>
      <div className="page-body">
        <div className="page-inner">
          <div className="split">
            <div className="stack">
              <Card title="Theme" sub="Start from a preset, then adjust anything below.">
                <div className="presets">
                  {Object.entries(PRESETS).map(([k, p]) => (
                    <button
                      key={k}
                      className={`preset${d.preset === k ? ' on' : ''}`}
                      type="button"
                      data-preset={k}
                      onClick={() => applyPreset(k)}
                    >
                      <span className="preset-thumb" style={{ background: p.bg, color: p.color, fontFamily: FONT_CSS[p.font] }}>
                        Aa
                      </span>
                      <span className="preset-name">{p.name}</span>
                    </button>
                  ))}
                  {d.preset === 'custom' && (
                    <span className="pill muted" style={{ alignSelf: 'center' }}>
                      Custom
                    </span>
                  )}
                </div>
              </Card>

              <Card title="Text">
                <Row
                  label="Font"
                  ctl={
                    <Segmented
                      value={d.font}
                      onChange={(v) => editField('display.font', v)}
                      options={[
                        { val: 'serif', label: 'Serif' },
                        { val: 'sans', label: 'Sans' },
                        { val: 'georgia', label: 'Georgia' },
                      ]}
                    />
                  }
                />
                <Row
                  label="Text colour"
                  ctl={
                    <>
                      <Swatches value={d.color} onChange={(v) => editField('display.color', v)} colors={TEXT_COLORS} />
                      <ColorInput value={d.color} onChange={(v) => editField('display.color', v)} label="Custom text colour" />
                    </>
                  }
                />
                <Row
                  label="Reference colour"
                  hint="The book, chapter and verse line, and verse numbers."
                  ctl={<ColorInput value={d.ref} onChange={(v) => editField('display.ref', v)} label="Reference colour" />}
                />
                <Row
                  label="Alignment"
                  ctl={
                    <Segmented
                      value={d.align}
                      onChange={(v) => editField('display.align', v)}
                      options={[
                        { val: 'left', label: 'Left' },
                        { val: 'center', label: 'Center' },
                      ]}
                    />
                  }
                />
                <Row
                  label="Line spacing"
                  ctl={
                    <SliderRow value={d.lh} onChange={(v) => editField('display.lh', v)} min={1.1} max={1.8} step={0.02} unit="×" />
                  }
                />
                <Row
                  label="Text shadow"
                  hint="Helps text stay readable over photo or video backgrounds."
                  ctl={<Switch checked={d.shadow} onChange={(v) => editField('display.shadow', v)} label="Text shadow" />}
                  last
                />
              </Card>

              <Card title="Layout">
                <Row
                  label="Reference position"
                  ctl={
                    <Segmented
                      value={d.refPos}
                      onChange={(v) => editField('display.refPos', v)}
                      options={[
                        { val: 'below', label: 'Below' },
                        { val: 'above', label: 'Above' },
                        { val: 'hidden', label: 'Hidden' },
                      ]}
                    />
                  }
                />
                <Row
                  label="Verse numbers"
                  hint="Shown when several verses share one slide."
                  ctl={<Switch checked={d.showNums} onChange={(v) => editField('display.showNums', v)} label="Verse numbers" />}
                />
                <Row
                  label="Side margins"
                  hint="Space kept clear left and right, on the 1920×1080 canvas."
                  ctl={<SliderRow value={d.safeX} onChange={(v) => editField('display.safeX', v)} min={40} max={320} step={10} unit=" px" />}
                />
                <Row
                  label="Top and bottom margins"
                  ctl={<SliderRow value={d.safeY} onChange={(v) => editField('display.safeY', v)} min={40} max={260} step={10} unit=" px" />}
                  last
                />
              </Card>

              <Card title="Auto-fit" sub="Text is sized to the largest size that fits inside the margins.">
                <Row
                  label="Largest text size"
                  hint="Short verses grow up to this size."
                  ctl={<SliderRow value={d.maxFs} onChange={(v) => editField('display.maxFs', v)} min={60} max={140} step={2} unit=" px" />}
                />
                <Row
                  label="Smallest text size"
                  hint="Below this the preview warns that the text is too long."
                  ctl={<SliderRow value={d.minFs} onChange={(v) => editField('display.minFs', v)} min={20} max={60} step={2} unit=" px" />}
                  last
                />
              </Card>

              <Card title="Background" sub="Image and video backgrounds arrive with the theme editor.">
                <Row
                  label="Colour"
                  ctl={
                    <>
                      <Swatches value={d.bg} onChange={(v) => editField('display.bg', v)} colors={BG_COLORS} />
                      <ColorInput value={d.bg} onChange={(v) => editField('display.bg', v)} label="Custom background colour" />
                    </>
                  }
                  last
                />
              </Card>
            </div>

            <div className="sticky">
              <Card
                title="Preview"
                headRight={<span className="mono">{fit || 'auto-fit …'}</span>}
                pad
              >
                <div className="ds-preview-wrap">
                  <DisplayPreview store={store} onFit={onFit} />
                  <Row
                    label="Sample"
                    ctl={
                      <Segmented
                        value={store.ui.sample}
                        onChange={(v) => commit('ui.sample', v)}
                        options={[
                          { val: 'short', label: 'Short' },
                          { val: 'long', label: 'Longest verse' },
                          { val: 'stack', label: '3-verse stack' },
                        ]}
                      />
                    }
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <div className="page-footer">
        <button className="btn" type="button" onClick={reset}>
          Reset to defaults
        </button>
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