import { useEffect, useState } from 'react'
import { StoreProvider } from './store'
import { DisplaySettings } from './screens/DisplaySettings'
import { OutputRouting } from './screens/OutputRouting'
import { SettingsScreen } from './screens/SettingsScreen'

type Page = 'display' | 'output' | 'settings'

const PAGES: Array<{ id: Page; title: string }> = [
  { id: 'display', title: 'Display settings' },
  { id: 'output', title: 'Output routing' },
  { id: 'settings', title: 'Settings' },
]

function initialPage(): Page {
  const q = new URLSearchParams(window.location.search).get('page')
  return q === 'display' || q === 'output' || q === 'settings' ? q : 'display'
}

function Inner() {
  const [page] = useState<Page>(initialPage)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') window.close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const title = PAGES.find((p) => p.id === page)?.title ?? 'Settings'
  useEffect(() => {
    document.title = `Scripture Caster — ${title}`
  }, [title])

  return (
    <div className="app paged">
      {page === 'display' && <DisplaySettings />}
      {page === 'output' && <OutputRouting />}
      {page === 'settings' && <SettingsScreen />}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Inner />
    </StoreProvider>
  )
}