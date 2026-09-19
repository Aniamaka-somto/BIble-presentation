import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from 'react'
import { useOperator } from '../store'
import { api } from '../api'
import type { BookRef } from '../../../shared/types'
import type { StageVerse } from '../types'
import { verseSlide } from '../lib/slideBuild'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

function verseNumberLabel(v: StageVerse): string {
  return v.endVerse && v.endVerse > v.n ? `${v.n}\u2013${v.endVerse}` : String(v.n)
}

const bookAliases: Record<string, string> = {
  ps: 'Psalms',
  psalm: 'Psalms',
  gen: 'Genesis',
  ex: 'Exodus',
  matt: 'Matthew',
  rom: 'Romans',
  jn: 'John',
  rev: 'Revelation',
  heb: 'Hebrews',
  cor: 'Corinthians',
}

type SearchPhase = 'book' | 'chapter' | 'verse'

export function VerseBrowser() {
  const tab = useOperator((s) => s.browserTab)
  const setTab = useOperator((s) => s.setBrowserTab)
  const verseData = useOperator((s) => s.verseData)
  const lastChapter = useOperator((s) => s.lastChapter)
  const contextQuery = useOperator((s) => s.contextQuery)
  const setContextQuery = useOperator((s) => s.setContextQuery)
  const contextResults = useOperator((s) => s.contextResults)
  const runContextSearch = useOperator((s) => s.runContextSearch)
  const stageAndOpenRef = useOperator((s) => s.stageAndOpenRef)
  const stepStagedVerse = useOperator((s) => s.stepStagedVerse)
  const addToSchedule = useOperator((s) => s.addToSchedule)
  const setStaged = useOperator((s) => s.setStaged)
  const staged = useOperator((s) => s.staged)
  const togglePick = useOperator((s) => s.togglePick)
  const clearPicks = useOperator((s) => s.clearPicks)
  const stackPicks = useOperator((s) => s.stackPicks)
  const picks = useOperator((s) => s.picks)
  const live = useOperator((s) => s.live)
  const translations = useOperator((s) => s.translations)
  const currentTranslation = useOperator((s) => s.currentTranslation)
  const switchTranslation = useOperator((s) => s.switchTranslation)

  const gridRef = useRef<HTMLDivElement>(null)
  const refEl = useRef<HTMLInputElement>(null)
  const [refInput, setRefInput] = useState('')
  const [ctxInput, setCtxInput] = useState('')
  const [books, setBooks] = useState<BookRef[]>([])
  const [animRef, setAnimRef] = useState<string | null>(null)
  const ctxTimer = useRef<number | null>(null)
  const animTimer = useRef<number | null>(null)

  const searchPhase = useRef<SearchPhase>('book')
  const searchBook = useRef('')
  const searchChapter = useRef('')
  const searchVerse = useRef('')
  const searchMaxVerse = useRef(0)
  const suppressSet = useRef(false)
  const deleting = useRef(false)
  const pendingSel = useRef<{ from: number; to: number } | null>(null)

  useLayoutEffect(() => {
    const el = refEl.current
    if (el && pendingSel.current) {
      el.setSelectionRange(pendingSel.current.from, pendingSel.current.to)
      pendingSel.current = null
    }
  }, [refInput])

  useEffect(() => {
    let cancelled = false
    api.getBookList(currentTranslation).then((list) => {
      if (!cancelled) setBooks(list ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [currentTranslation])

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

  useEffect(() => {
    return () => {
      if (animTimer.current) window.clearTimeout(animTimer.current)
      if (ctxTimer.current) window.clearTimeout(ctxTimer.current)
    }
  }, [])

  useEffect(() => {
    if (tab !== 'book') return
    const grid = gridRef.current
    const el = grid?.querySelector('.verse-card.staged-preview')
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [staged, tab, verseData])

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

  // ----- EasyWorship-style phased reference search -----
  function findBook(prefix: string): BookRef | null {
    const lower = prefix.toLowerCase().replace(/\s+/g, '')
    if (!lower) return null
    for (const b of books) {
      const key = b.name.toLowerCase().replace(/\s+/g, '')
      if (key.startsWith(lower)) return b
    }
    const alias = bookAliases[lower]
    if (alias) return books.find((b) => b.name === alias) ?? null
    const noNum = lower.replace(/^\d/, '')
    if (noNum !== lower) {
      for (const b of books) {
        const key = b.name
          .toLowerCase()
          .replace(/^\d+\s+/, '')
          .replace(/\s+/g, '')
        if (key.startsWith(noNum)) return b
      }
    }
    return null
  }

  function setInput(value: string) {
    suppressSet.current = true
    setRefInput(value)
    suppressSet.current = false
  }

  function resetSearch() {
    searchPhase.current = 'book'
    searchBook.current = ''
    searchChapter.current = ''
    searchVerse.current = ''
    searchMaxVerse.current = 0
  }

  function commitSearch() {
    const ch = parseInt(searchChapter.current || '1', 10)
    const vs = parseInt(searchVerse.current || '1', 10)
    if (!searchBook.current) return
    const book = books.find((b) => b.name === searchBook.current)
    if (!book || ch < 1 || ch > book.chapters) {
      resetSearch()
      return
    }
    if (searchVerse.current) {
      api
        .getChapter(searchBook.current, ch, currentTranslation)
        .then((verses) => {
          if (!verses.some((v) => v.verse <= vs && vs <= (v.endVerse ?? v.verse))) {
            resetSearch()
            return
          }
          void stageAndOpenRef(searchBook.current, ch, vs)
          resetSearch()
        })
        .catch(() => resetSearch())
    } else {
      void stageAndOpenRef(searchBook.current, ch, vs)
      resetSearch()
    }
  }

  function handleSpace() {
    const phase = searchPhase.current
    if (phase === 'book') {
      if (searchBook.current) {
        searchPhase.current = 'chapter'
        setInput(`${searchBook.current} `)
      }
      return
    }
    if (phase === 'chapter') {
      if (searchChapter.current) {
        const ch = parseInt(searchChapter.current, 10)
        const book = books.find((b) => b.name === searchBook.current)
        if (!book || ch < 1 || ch > book.chapters) return
        searchMaxVerse.current = 0
        api
          .getChapter(searchBook.current, ch, currentTranslation)
          .then((verses) => {
            searchMaxVerse.current = verses.reduce(
              (mx, v) => Math.max(mx, v.endVerse ?? v.verse),
              0,
            )
          })
          .catch(() => {})
        searchPhase.current = 'verse'
        setInput(`${searchBook.current} ${searchChapter.current}:`)
      }
      return
    }
    if (phase === 'verse' && searchVerse.current) {
      commitSearch()
      setInput('')
    }
  }

  function onRefKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key === ' ') {
      e.preventDefault()
      handleSpace()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commitSearch()
      setInput('')
      return
    }
    if (e.key === 'Backspace') {
      const phase = searchPhase.current
      if (phase === 'verse' && !searchVerse.current && searchChapter.current) {
        searchPhase.current = 'chapter'
        setInput(`${searchBook.current} ${searchChapter.current}`)
        return
      }
      if (phase === 'chapter' && !searchChapter.current && searchBook.current) {
        searchPhase.current = 'book'
        setInput(searchBook.current)
        return
      }
      deleting.current = true
    }
  }

  function onRefChange(value: string) {
    if (suppressSet.current) return
    const phase = searchPhase.current
    if (phase === 'book') {
      const letters = value.replace(/[^a-zA-Z0-9\s]/g, '').trim()
      if (!letters) {
        searchBook.current = ''
        return
      }
      const book = findBook(letters)
      if (!book) {
        const prev = searchBook.current || ''
        setInput(prev)
        if (prev && letters.length > 1) {
          pendingSel.current = {
            from: Math.min(letters.length - 1, prev.length),
            to: prev.length,
          }
        }
        return
      }
      searchBook.current = book.name
      if (deleting.current) {
        deleting.current = false
        setInput(value)
        return
      }
      const completed = book.name.slice(letters.length)
      setInput(book.name)
      pendingSel.current = {
        from: completed ? letters.length : book.name.length,
        to: book.name.length,
      }
      return
    }
    if (phase === 'chapter') {
      const digits = value.replace(/[^\d]/g, '')
      if (digits) {
        const ch = parseInt(digits, 10)
        const book = books.find((b) => b.name === searchBook.current)
        if (book && ch > book.chapters) searchChapter.current = digits.slice(0, -1)
        else searchChapter.current = digits
      } else {
        searchChapter.current = ''
      }
      const next = `${searchBook.current} ${searchChapter.current}`
      setInput(next)
      pendingSel.current = { from: next.length, to: next.length }
      return
    }
    // verse phase
    const prefix = `${searchBook.current} ${searchChapter.current}:`
    const digits = value.slice(prefix.length).replace(/[^\d]/g, '')
    if (digits && searchMaxVerse.current > 0) {
      const vs = parseInt(digits, 10)
      searchVerse.current = vs > searchMaxVerse.current ? digits.slice(0, -1) : digits
    } else {
      searchVerse.current = digits
    }
    const next = prefix + searchVerse.current
    setInput(next)
    pendingSel.current = { from: next.length, to: next.length }
  }

  function handleCard(ref: string, text: string, e: MouseEvent<HTMLButtonElement>) {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      togglePick({ ref, text })
      return
    }
    if (tab === 'context') {
      const m = String(ref).trim().match(/^(.+?)\s+(\d+):(\d+)/)
      if (m) {
        void stageAndOpenRef(m[1], Number(m[2]), Number(m[3]))
        return
      }
    }
    setStaged(verseSlide(ref, text), null)
  }

  function addVerse(ref: string, text: string) {
    if (animRef === ref) return
    addToSchedule(verseSlide(ref, text), tab === 'context' ? 'Context search' : 'Manual')
    setAnimRef(ref)
    if (animTimer.current) window.clearTimeout(animTimer.current)
    animTimer.current = window.setTimeout(() => setAnimRef(null), 620)
  }

  function onPlusKey(ref: string, text: string, e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      addVerse(ref, text)
    }
  }

  function onCtxChange(value: string) {
    setCtxInput(value)
    setContextQuery(value)
    if (ctxTimer.current) window.clearTimeout(ctxTimer.current)
    ctxTimer.current = window.setTimeout(() => {
      if (value.trim()) runContextSearch()
    }, 180)
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
        <div className="res-field" hidden={tab !== 'book'}>
          <input
            className="res-input"
            ref={refEl}
            value={refInput}
            aria-label="Reference"
            autoComplete="off"
            placeholder="Reference only — e.g. John 3:16"
            onKeyDown={onRefKey}
            onChange={(e) => onRefChange(e.target.value)}
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
        <div className="res-select-wrap" title="Translation" hidden={tab !== 'book'}>
          <select
            className="res-select"
            aria-label="Translation"
            value={currentTranslation}
            onChange={(e) => switchTranslation(e.target.value)}
          >
            {(translations.length > 0 ? translations : [{ id: currentTranslation, name: currentTranslation }]).map(
              (t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              )
            )}
          </select>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
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
        <div className="res-nav" hidden={tab !== 'book'}>
          <button
            title="Previous verse"
            aria-label="Previous verse"
            onClick={() => stepStagedVerse(-1)}
          >
            <ChevronLeftIcon />
          </button>
          <button
            title="Next verse"
            aria-label="Next verse"
            onClick={() => stepStagedVerse(1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </div>
      <div className="resource-body">
        <div className="verse-grid" ref={gridRef}>
          {cards.map((v) => {
            const isStaged = !!staged && staged.refs.includes(v.ref)
            const isLive = !!live && live.refs.includes(v.ref)
            const picked = picks.some((p) => p.ref === v.ref)
            const anim = animRef === v.ref
            return (
              <button
                type="button"
                key={v.ref}
                className={`verse-card${isStaged && !isLive ? ' staged-preview' : ''}${isLive ? ' live' : ''}${picked ? ' picked' : ''}${anim ? ' add-flash' : ''}`}
                title="Click to preview · Shift-click to stack verses"
                onClick={(e) => handleCard(v.ref, v.text, e)}
              >
                <div className="verse-card-top">
                  <div className="verse-num">
                    {tab === 'book' ? verseNumberLabel(v) : v.ref}
                  </div>
                  <div
                    role="button"
                    tabIndex={0}
                    className={`verse-add${anim ? ' animating' : ''}`}
                    title="Add to schedule"
                    aria-label={`Add ${v.ref} to schedule`}
                    onClick={(e) => {
                      e.stopPropagation()
                      addVerse(v.ref, v.text)
                    }}
                    onKeyDown={(e) => onPlusKey(v.ref, v.text, e)}
                  >
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
                      strokeLinecap="round"
                      strokeLinejoin="round"
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