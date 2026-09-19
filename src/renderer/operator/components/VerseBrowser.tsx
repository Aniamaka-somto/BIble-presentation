import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { useOperator } from '../store'
import type { StageVerse } from '../types'
import { verseSlide } from '../lib/slideBuild'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon } from './icons'

function verseNumberLabel(v: StageVerse): string {
  return v.endVerse && v.endVerse > v.n ? `${v.n}\u2013${v.endVerse}` : String(v.n)
}

const SCROLL_STEP = 492

interface ParsedRef {
  book: string
  chapter: number
}

function parseRefInput(raw: string): ParsedRef | null {
  const m = String(raw).trim().match(/^([^:\d\s][^:]*?)\s+(\d+)(?::\s*(\d+))?/)
  if (!m) return null
  return { book: m[1], chapter: Number(m[2]) }
}

export function VerseBrowser() {
  const tab = useOperator((s) => s.browserTab)
  const setTab = useOperator((s) => s.setBrowserTab)
  const verseData = useOperator((s) => s.verseData)
  const lastChapter = useOperator((s) => s.lastChapter)
  const contextQuery = useOperator((s) => s.contextQuery)
  const setContextQuery = useOperator((s) => s.setContextQuery)
  const contextResults = useOperator((s) => s.contextResults)
  const runContextSearch = useOperator((s) => s.runContextSearch)
  const loadChapter = useOperator((s) => s.loadChapter)
  const addToSchedule = useOperator((s) => s.addToSchedule)
  const togglePick = useOperator((s) => s.togglePick)
  const clearPicks = useOperator((s) => s.clearPicks)
  const stackPicks = useOperator((s) => s.stackPicks)
  const picks = useOperator((s) => s.picks)
  const scheduledRefs = useOperator((s) => s.scheduledRefs)

  const gridRef = useRef<HTMLDivElement>(null)
  const [refInput, setRefInput] = useState('Genesis 1')
  const [ctxInput, setCtxInput] = useState('')
  const ctxTimer = useRef<number | null>(null)

  useEffect(() => {
    if (lastChapter && lastChapter.book && lastChapter.chapter) {
      setRefInput(`${lastChapter.book} ${lastChapter.chapter}`)
    }
  }, [lastChapter])

  useEffect(() => {
    const grid = gridRef.current
    if (!grid) return
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        grid.scrollLeft += e.deltaY
        e.preventDefault()
      }
    }
    grid.addEventListener('wheel', onWheel, { passive: false })
    return () => grid.removeEventListener('wheel', onWheel)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearPicks()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clearPicks])

  function scrollVerses(dir: number) {
    gridRef.current?.scrollBy({ left: dir * SCROLL_STEP, behavior: 'smooth' })
  }

  const chapterLabel = lastChapter?.book
    ? `${lastChapter.book} ${lastChapter.chapter}`
    : 'Genesis 1'

  const heading =
    tab === 'book'
      ? chapterLabel
      : contextQuery.trim()
        ? `${contextResults.length} match${contextResults.length === 1 ? '' : 'es'}`
        : ''

  const showCtx =
    tab === 'context' &&
    (contextQuery.trim() === '' || contextResults.length === 0)

  const ctxTitle = contextQuery.trim() ? 'No matching verses' : 'Search by context'
  const ctxSub = contextQuery.trim()
    ? 'Try different words, or a theme like light, water or creation'
    : 'Enter quotes, themes, or paraphrases to find matching verses'

  const cards: StageVerse[] =
    tab === 'book'
      ? Object.values(verseData)
      : contextResults.map((r) => ({
          n: 0,
          text: r.text,
          ref: r.ref,
          book: '',
          chapter: 0,
        }))

  function handleCard(ref: string, text: string, e: MouseEvent<HTMLButtonElement>) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      togglePick({ ref, text })
      return
    }
    addToSchedule(verseSlide(ref, text), tab === 'context' ? 'Context search' : 'Manual')
  }

  function onCtxChange(value: string) {
    setCtxInput(value)
    setContextQuery(value)
    if (ctxTimer.current) window.clearTimeout(ctxTimer.current)
    ctxTimer.current = window.setTimeout(() => {
      if (value.trim()) runContextSearch()
    }, 180)
  }

  function onRefEnter() {
    const parsed = parseRefInput(refInput)
    if (!parsed) return
    loadChapter(parsed.book, parsed.chapter)
  }

  return (
    <section className="resource-bar">
      <div className="resource-head">
        <button
          className={`res-tab${tab === 'book' ? ' active' : ''}`}
          onClick={() => setTab('book')}
        >
          Book search
        </button>
        <button
          className={`res-tab${tab === 'context' ? ' active' : ''}`}
          onClick={() => setTab('context')}
        >
          Context search
        </button>
        <div className="res-field">
          <input
            className="res-input"
            value={refInput}
            aria-label="Reference"
            autoComplete="off"
            onChange={(e) => setRefInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRefEnter()
            }}
          />
        </div>
        <div className="res-field has-icon" hidden={tab !== 'context'}>
          <svg
            className="res-search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            className="res-input"
            type="text"
            placeholder="Search quotes, themes…"
            aria-label="Search by context"
            autoComplete="off"
            value={ctxInput}
            onChange={(e) => onCtxChange(e.target.value)}
          />
        </div>
        <div className="res-book">{heading}</div>
        <button
          className="stack-btn"
          type="button"
          hidden={picks.length < 2}
          onClick={stackPicks}
        >
          Stack {picks.length} verses
        </button>
        <div className="res-nav">
          <button
            title="Scroll back"
            aria-label="Scroll verses back"
            onClick={() => scrollVerses(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            title="Scroll forward"
            aria-label="Scroll verses forward"
            onClick={() => scrollVerses(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div className="resource-body">
        <div className="verse-grid" ref={gridRef}>
          {cards.map((v) => {
            const inSched = scheduledRefs.includes(v.ref)
            const picked = picks.some((p) => p.ref === v.ref)
            return (
              <button
                type="button"
                key={v.ref}
                className={`verse-card${inSched ? ' in-schedule' : ''}${picked ? ' picked' : ''}`}
                title="Click to add · Shift-click to stack verses on one slide"
                onClick={(e) => handleCard(v.ref, v.text, e)}
              >
                <div className="verse-card-top">
                  <div className="verse-num">
                    {tab === 'book' ? verseNumberLabel(v) : v.ref}
                  </div>
                  <div className="verse-add">
                    <svg
                      className="ic-plus"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <svg
                      className="ic-check"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.2"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <div className="verse-text">{v.text}</div>
              </button>
            )
          })}
        </div>
        <div className={`ctx-state${showCtx ? ' show' : ''}`}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 11c0-3.3 1.8-5.6 5-6l.5 1.5C7.7 7 7 8.2 7 9.5H9.5V15H4v-4zm10 0c0-3.3 1.8-5.6 5-6l.5 1.5c-1.8.5-2.5 1.7-2.5 3H19.5V15H14v-4z" />
          </svg>
          <div className="ctx-state-title">{ctxTitle}</div>
          <div className="ctx-state-sub">{ctxSub}</div>
        </div>
      </div>
    </section>
  )
}