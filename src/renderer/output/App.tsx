import { useEffect, useState, type CSSProperties } from 'react'
import type { OutputState } from '../../shared/types'

declare global {
  interface Window {
    scriptureCaster: {
      onOutputStateChanged: (cb: (state: OutputState) => void) => () => void
    }
  }
}

export default function App() {
  const [state, setState] = useState<OutputState>({ live: false, verse: null, blankMode: 'none' })

  useEffect(() => window.scriptureCaster.onOutputStateChanged(setState), [])

  const base: CSSProperties = {
    width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif"
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
