import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FONT_CSS, LONGEST, SAMPLE_VERSES, type Store } from './data'

export interface SlideBlock {
  ref: string
  parts: Array<{ num?: number; text: string }>
  translation?: string
}

export interface Slide {
  label: string
  blocks: SlideBlock[]
}

const chapterOf = (ref: string) => ref.replace(/:\d+$/, '')
const verseNo = (ref: string) => ref.split(':').pop() ?? ''

function verseSlide(ref: string, text: string): Slide {
  return { label: ref, blocks: [{ ref, parts: [{ text }], translation: 'KJV' }] }
}

function stackSlide(list: Array<{ ref: string; text: string }>): Slide {
  if (list.length === 1) return verseSlide(list[0].ref, list[0].text)
  if (list.every((v) => chapterOf(v.ref) === chapterOf(list[0].ref))) {
    const nums = list.map((v) => +verseNo(v.ref))
    const ref = `${chapterOf(list[0].ref)}:${nums.join(', ')}`
    return { label: ref, blocks: [{ ref, parts: list.map((v) => ({ num: +verseNo(v.ref), text: v.text })), translation: 'KJV' }] }
  }
  return { label: 'stacked', blocks: list.map((v) => ({ ref: v.ref, parts: [{ text: v.text }] })) }
}

function sampleSlide(store: Store): Slide {
  const k = store.ui.sample
  if (k === 'long') return verseSlide(`Genesis 1:${LONGEST[0]}`, LONGEST[1])
  if (k === 'stack') {
    return stackSlide(SAMPLE_VERSES.slice(2, 5).map(([n, text]) => ({ ref: `Genesis 1:${n}`, text })))
  }
  const [n, text] = SAMPLE_VERSES[2]
  return verseSlide(`Genesis 1:${n}`, text)
}

function SlideView({ slide, display, onFit }: { slide: Slide; display: Store['display']; onFit?: (f: { size: number; overflow: boolean }) => void }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<(f: { size: number; overflow: boolean }) => void>(() => {})
  fitRef.current = onFit ?? (() => {})
  const [scale, setScale] = useState(1)

  const vars: React.CSSProperties = {
    '--slide-bg': display.bg,
    '--slide-color': display.color,
    '--slide-ref': display.ref,
    '--slide-font': FONT_CSS[display.font] ?? display.font,
    '--slide-align': display.align,
    '--slide-lh': display.lh,
    '--safe-x': `${display.safeX}px`,
    '--safe-y': `${display.safeY}px`,
    '--slide-shadow': display.shadow ? '0 2px 14px rgba(0,0,0,.7)' : 'none',
  } as React.CSSProperties

  const [dataRef, dataNums] = [display.refPos, display.showNums]

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => {
      setScale(host.clientWidth / 1920)
      const flow = host.querySelector<HTMLDivElement>('.slide-flow')
      const safe = host.querySelector<HTMLDivElement>('.slide-safe')
      const root = host.querySelector<HTMLDivElement>('.slide')
      if (!flow || !safe || !root) return
      const minFs = Math.min(display.minFs, display.maxFs)
      let lo = minFs
      let hi = display.maxFs
      let best = lo
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        root.style.setProperty('--fs', `${mid}px`)
        if (flow.offsetHeight <= safe.clientHeight) {
          best = mid
          lo = mid + 1
        } else {
          hi = mid - 1
        }
      }
      root.style.setProperty('--fs', `${best}px`)
      fitRef.current({ size: best, overflow: flow.offsetHeight > safe.clientHeight })
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure)
    ro.observe(host)
    return () => ro.disconnect()
  }, [display, dataRef, dataNums])

  return (
    <div ref={hostRef} className="slide-host" data-ref={dataRef} data-nums={dataNums ? 'on' : 'off'}>
      <div className="slide" style={{ ...vars, transform: `scale(${scale})` }}>
        <div className="slide-safe">
          <div className="slide-flow">
            {slide.blocks.map((b, bi) => (
              <div className="s-block" key={bi}>
                <div className="s-text">
                  {b.parts.map((p, i) => (
                    <span key={i}>
                      {p.num ? <sup className="s-num">{p.num}</sup> : null}
                      {p.text}
                    </span>
                  ))}
                </div>
                <div className="s-ref">
                    {b.ref.toUpperCase()}
                    {b.translation ? <span className="s-version"> · {b.translation.toUpperCase()}</span> : null}
                  </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DisplayPreview({ store, onFit }: { store: Store; onFit?: (f: { size: number; overflow: boolean }) => void }) {
  const [slide, setSlide] = useState(() => sampleSlide(store))
  useEffect(() => {
    setSlide(sampleSlide(store))
  }, [store.ui.sample, store.display.font, store.display.bg, store.display.color])
  return <SlideView slide={slide} display={store.display} onFit={onFit} />
}