import { Fragment, useEffect, useState } from 'react'
import { useOperator } from '../store'
import { api } from '../api'
import { InfoIcon, SearchIcon, StarIcon } from './icons'
import type { BibleVerseRef } from '../../../shared/types'

export function Assistant() {
  const currentTranslation = useOperator((s) => s.currentTranslation)
  const loadAndStage = useOperator((s) => s.loadAndStage)
  const loadChapter = useOperator((s) => s.loadChapter)
  const pushLive = useOperator((s) => s.pushLive)
  const feed = useOperator((s) => s.feed)
  const autoPush = useOperator((s) => s.autoPush)
  const toggleAutoPush = useOperator((s) => s.toggleAutoPush)

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<BibleVerseRef[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const found = await api.searchVerses(q, currentTranslation)
        setResults(found)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, currentTranslation])

  function pushCard(book: string, chapter: number, verse: number, translation: string) {
    loadChapter(book, chapter, verse, translation).then(() => pushLive())
  }

  return (
    <div className="assistant">
      <div className="asst-head">
        <div className="asst-head-row">
          <div className="asst-title">
            <StarIcon />
            Detection
          </div>
          <div className="auto-switch">
            <span className={'auto-switch-label' + (autoPush ? ' on' : '')}>AUTO</span>
            <button
              type="button"
              role="switch"
              aria-checked={autoPush}
              aria-label="Auto-push spoken references to the live screen"
              className={'switch' + (autoPush ? ' on' : '')}
              onClick={toggleAutoPush}
            >
              <span className="k"></span>
            </button>
          </div>
        </div>
        <div className="asst-sub">
          {autoPush
            ? 'AUTO · spoken references go straight to the live screen'
            : 'Listening · suggests, never pushes'}
        </div>
      </div>
      <div className="asst-search">
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a passage — e.g. Romans 8:28"
        />
      </div>

      <div>
        {query.trim().length >= 3 && searching && (
          <div
            className="card"
            style={{
              margin: '0 16px 8px',
              color: 'var(--text-lo)',
              fontSize: '13px',
              textAlign: 'center',
            }}
          >
            Searching…
          </div>
        )}
        {query.trim().length >= 3 &&
          !searching &&
          results.length === 0 && (
            <div
              className="card"
              style={{
                margin: '0 16px 8px',
                color: 'var(--text-lo)',
                fontSize: '13px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              No verses found for “{query.trim()}”
            </div>
          )}
        {results.slice(0, 8).map((r) => {
          const startV = r.verse
          const endV = r.endVerse ?? startV
          const refStr = r.book + ' ' + r.chapter + ':' + startV + (endV > startV ? '-' + endV : '')
          return (
            <div
              key={`${r.book}${r.chapter}${startV}`}
              className="card"
              style={{ margin: '0 16px 8px', cursor: 'pointer' }}
              onClick={() => loadAndStage(r.book, r.chapter, startV)}
            >
              <div className="card-row">
                <span className="card-ref">{refStr}</span>
              </div>
              <div className="card-snip">{r.text}</div>
            </div>
          )
        })}
      </div>

      <div className="asst-feed">
        {feed.map((card) => (
          <Fragment key={card.id}>
            <div className="feed-time">{card.timeLabel}</div>
            <div className={'card' + (card.isTop ? ' top' : '')}>
              <div className="card-row">
                <span className="card-ref">{card.refStr}</span>
                <span className={'tag ' + (card.isParaphrase ? 'paraphrase' : 'explicit')}>
                  {card.tagText}
                </span>
                <span className="tag translation-tag">{card.translation}</span>
              </div>
              <div className="card-snip">{card.snippet}</div>
              <div className="card-actions">
                <div
                  className="mini-btn"
                  onClick={() => loadAndStage(card.book, card.chapter, card.verse, card.translation)}
                >
                  Preview
                </div>
                <div
                  className="mini-btn primary"
                  onClick={() => pushCard(card.book, card.chapter, card.verse, card.translation)}
                >
                  Push live
                </div>
              </div>
            </div>
          </Fragment>
        ))}
        <div className="feed-note">
          <InfoIcon />
          {autoPush ? 'AUTO is on — flip it off to take full control' : 'Nothing pushes without you'}
        </div>
      </div>
    </div>
  )
}