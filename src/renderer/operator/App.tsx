import { useEffect } from 'react'
import { useOperator } from './store'
import { TopBar } from './components/TopBar'
import { ScheduleList } from './components/ScheduleList'
import { ResourceLibrary } from './components/ResourceLibrary'
import { Stage } from './components/Stage'
import { Filmstrip } from './components/Filmstrip'
import { TranscriptBar } from './components/TranscriptBar'
import { Assistant } from './components/Assistant'
import { AlertsModal } from './components/AlertsModal'
import { DgKeyModal } from './components/DgKeyModal'

export default function App() {
  const outputMode = useOperator((s) => s.outputMode)

  useEffect(() => {
    const state = useOperator.getState()
    state.loadTranslations()
    state.loadChapter('Luke', 1, 17, state.currentTranslation)
  }, [])

  return (
    <>
      <div className={'app' + (outputMode === 'split' ? ' split-mode' : '')}>
        <TopBar />
        <div className="left-col">
          <ScheduleList />
          <ResourceLibrary />
        </div>
        <div className="center-col">
          <Stage />
          <Filmstrip />
          <TranscriptBar />
        </div>
        <Assistant />
      </div>
      <AlertsModal />
      <DgKeyModal />
    </>
  )
}