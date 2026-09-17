import { useOperator } from '../store'
import { LibrarySearchInput } from './LibrarySearchInput'
import { BackgroundManager } from './BackgroundManager'
import type { LibraryTab } from '../types'

const TABS: { id: LibraryTab; label: string; primary?: boolean }[] = [
  { id: 'scripture', label: 'Scripture', primary: true },
  { id: 'songs', label: 'Songs' },
  { id: 'media', label: 'Media' },
  { id: 'web', label: 'Web' },
  { id: 'themes', label: 'Backgrounds' },
]

export function ResourceLibrary() {
  const activeTab = useOperator((s) => s.activeTab)
  const setActiveTab = useOperator((s) => s.setActiveTab)
  const loadBackgrounds = useOperator((s) => s.loadBackgrounds)
  const translations = useOperator((s) => s.translations)
  const currentTranslation = useOperator((s) => s.currentTranslation)
  const switchTranslation = useOperator((s) => s.switchTranslation)
  const deleteTranslation = useOperator((s) => s.deleteTranslation)
  const importTranslation = useOperator((s) => s.importTranslation)

  const isBg = activeTab === 'themes'

  function selectTab(tab: LibraryTab) {
    setActiveTab(tab)
    if (tab === 'themes') loadBackgrounds()
  }

  return (
    <div className="resource-lib">
      <div className="lib-tabs">
        {TABS.map((tab) => (
          <div
            key={tab.id}
            className={
              'lib-tab' +
              (tab.primary ? ' primary' : '') +
              (activeTab === tab.id ? ' on' : '')
            }
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
          </div>
        ))}
      </div>

      <LibrarySearchInput hidden={isBg} />

      <div className={'lib-list' + (isBg ? ' hide' : '')}>
        <div className="translation-header">
          <span className="translation-label">Translation</span>
          <div
            className="translation-add"
            title="Import translation"
            onClick={() => importTranslation()}
          >
            +
          </div>
        </div>
        <div className="translation-list">
          {translations.map((t) => (
            <div
              key={t.id}
              className={'translation-list-item' + (t.id === currentTranslation ? ' on' : '')}
              onClick={() => switchTranslation(t.id)}
            >
              <span>{t.name}</span>
              {t.id !== 'KJV' && (
                <span
                  className="del"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteTranslation(t.id)
                  }}
                >
                  ✕
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      <BackgroundManager />
    </div>
  )
}