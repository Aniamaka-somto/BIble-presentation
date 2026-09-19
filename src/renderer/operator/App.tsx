import { useEffect } from 'react'
import { useOperator } from './store'
import { TopBar } from './components/TopBar'
import { ScheduleList } from './components/ScheduleList'
import { PreviewArea } from './components/PreviewArea'
import { Transcript } from './components/Transcript'
import { VerseBrowser } from './components/VerseBrowser'
import { RightColumn } from './components/RightColumn'
import { DgKeyModal } from './components/DgKeyModal'

export default function App() {
  const dgKeyOpen = useOperator((s) => s.dgKeyOpen)

  useEffect(() => {
    const state = useOperator.getState()
    state.loadTranslations()
    state.loadChapter('Genesis', 1).then(() => {
      const v = useOperator.getState().verseData[3]
      if (v) useOperator.getState().addToSchedule(
        { label: v.ref, refs: [v.ref], blocks: [{ ref: v.ref, parts: [{ text: v.text }] }], theme: 'default', layout: 'single' },
        'Manual'
      )
    })
  }, [])

  return (
    <div className="app">
      <TopBar />
      <main className="main">
        <div className="col col-left">
          <ScheduleList />
        </div>
        <div className="preview-area">
          <PreviewArea />
        </div>
        <Transcript />
        <VerseBrowser />
        <div className="col col-right">
          <RightColumn />
        </div>
      </main>
      {dgKeyOpen && <DgKeyModal />}
    </div>
  )
}