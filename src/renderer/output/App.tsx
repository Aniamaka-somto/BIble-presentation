import { useEffect, useState, useRef, type CSSProperties } from 'react'
import type { OutputState } from '../../shared/types'

declare global {
  interface Window {
    scriptureCaster: {
      onOutputStateChanged: (cb: (state: OutputState) => void) => () => void
    }
  }
}

function BgLayer({ state, style }: { state: OutputState; style: CSSProperties }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (state.background?.type === 'video' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }, [state.background])

  if (!state.background) return null

  const src = `bg://${state.background.fileName}`

  if (state.background.type === 'image') {
    return (
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        ...style,
      }} />
    )
  }

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        ...style,
      }}
    />
  )
}

export default function App() {
  const [state, setState] = useState<OutputState>({
    live: false, verse: null, blankMode: 'none', background: null,
  })

  useEffect(() => window.scriptureCaster.onOutputStateChanged(setState), [])

  const base: CSSProperties = {
    width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden',
  }

  if (state.blankMode === 'black') {
    return <div style={{ ...base, background: '#000' }} />
  }

  if (state.blankMode === 'logo') {
    return (
      <div style={{ ...base, background: '#0a0b0f' }}>
        <p style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: '3vw', color: '#93a9ff' }}>
          Scripture Caster
        </p>
      </div>
    )
  }

  // When a background is active, render it underneath
  if (state.background) {
    return (
      <div style={{ ...base, background: '#0a0b0f', color: '#f1f2f7' }}>
        <BgLayer state={state} style={{ zIndex: 0 }} />
        {state.live && state.verse && (
          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
            <p style={{
              fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
              fontSize: 'clamp(28px, 4.2vw, 64px)', lineHeight: 1.45,
              maxWidth: '82%', textAlign: 'center', margin: 0,
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
            }}>
              {state.verse.text}
            </p>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1vw',
              letterSpacing: '0.1em', color: '#93a9ff', marginTop: '2rem',
              textShadow: '0 1px 6px rgba(0,0,0,0.5)',
            }}>
              {state.verse.book.toUpperCase()} {state.verse.chapter}:{state.verse.verse} · {state.verse.translation}
            </p>
          </div>
        )}
      </div>
    )
  }

  if (!state.live || !state.verse) return <div style={{ background: 'transparent', width: '100vw', height: '100vh' }} />

  return (
    <div style={{ ...base, background: '#0a0b0f', color: '#f1f2f7' }}>
      <p style={{
        fontFamily: "'Fraunces', Georgia, serif", fontWeight: 500,
        fontSize: 'clamp(28px, 4.2vw, 64px)', lineHeight: 1.45,
        maxWidth: '82%', textAlign: 'center', margin: 0
      }}>
        {state.verse.text}
      </p>
      <p style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1vw',
        letterSpacing: '0.1em', color: '#93a9ff', marginTop: '2rem'
      }}>
        {state.verse.book.toUpperCase()} {state.verse.chapter}:{state.verse.verse} · {state.verse.translation}
      </p>
    </div>
  )
}
