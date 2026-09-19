import { create } from 'zustand'
import { api } from './api'
import type {
  StageVerse,
  BlankMode,
  ListeningStatus,
  BrowserTab,
  ScheduleEntry,
  TranscriptLine,
  DetectionCard,
  DetectionInput,
  VersePick,
  ContextResult,
} from './types'
import type { Slide, BackgroundItem, BackgroundSource, TranslationInfo, BookRef } from '../../shared/types'
import { verseSlide, stackSlide } from './lib/slideBuild'
import type { SlideFit } from '../shared/slide'

export interface ChapterInfo {
  book: string
  chapter: number
}

interface OperatorState {
  // Translations
  translations: TranslationInfo[]
  currentTranslation: string

  // Bible browser
  verseData: Record<number, StageVerse>
  verseCount: number
  lastChapter: ChapterInfo | null
  browserTab: BrowserTab
  contextQuery: string
  contextResults: ContextResult[]

  // Cue list (schedule) + staging
  schedule: ScheduleEntry[]
  scheduledRefs: string[]
  staged: Slide | null
  stagedEntryId: string | null
  stagedFit: SlideFit | null
  live: Slide | null
  liveEntryId: string | null
  isLive: boolean

  // Right monitor (output preview)
  monitorSlide: Slide | null

  // Picks (stacking)
  picks: VersePick[]

  // Output
  blankMode: BlankMode
  outputVisible: boolean

  // Backgrounds
  backgrounds: BackgroundItem[]
  activeBackground: BackgroundSource | null

  // Assistant
  feed: DetectionCard[]

  // Reading lock: suppresses paraphrase suggestions shortly after any push.
  lastPushAt: number | null

  // Listening
  listeningStatus: ListeningStatus
  reconnectAttempts: number
  transcriptLines: TranscriptLine[]

  // Modals
  alertsOpen: boolean
  dgKeyOpen: boolean

  // Actions
  loadTranslations: () => Promise<void>
  switchTranslation: (id: string) => Promise<void>
  deleteTranslation: (id: string) => Promise<void>
  importTranslation: () => Promise<void>

  loadChapter: (book: string, chapter: number, translation?: string) => Promise<void>
  navigateChapter: (dir: number) => Promise<void>
  stageBibleVerse: (book: string, chapter: number, verse: number, endVerse?: number, translation?: string) => Promise<Slide | null>
  stageAndOpenRef: (book: string, chapter: number, verse?: number) => Promise<void>
  stepStagedVerse: (dir: number) => Promise<void>

  setBrowserTab: (tab: BrowserTab) => void
  setContextQuery: (q: string) => void
  runContextSearch: () => Promise<void>

  addToSchedule: (slide: Slide, src: string) => void
  removeFromSchedule: (id: string) => void
  clearSchedule: () => void
  setStaged: (slide: Slide, entryId?: string | null) => void
  setStagedFit: (fit: SlideFit | null) => void
  previewStaged: () => void
  goLive: () => void

  togglePick: (pick: VersePick) => void
  clearPicks: () => void
  stackPicks: () => void

  toggleBlank: (mode: Exclude<BlankMode, 'none'>) => void
  toggleOutputVisibility: () => void

  loadBackgrounds: () => Promise<void>
  addBackground: () => Promise<void>
  deleteBackground: (id: string) => Promise<void>
  selectBackground: (src: BackgroundSource) => void

  addDetection: (input: DetectionInput) => Promise<void>
  clearFeed: () => void

  setListeningStatus: (status: ListeningStatus) => void
  setReconnectAttempts: (n: number) => void
  commitTranscriptFinal: (text: string, refs: { book: string; matchedText: string }[]) => void
  updateInterim: (text: string) => void
  clearTranscript: () => void

  setAlertsOpen: (open: boolean) => void
  sendAlert: (message: string) => void

  openDgKeyPrompt: () => Promise<string | null>
  submitDgKey: (key: string | null) => void
}

export const READING_LOCK_MS = 30000
const MAX_TRANSCRIPT_LINES = 45

let dgResolve: ((key: string | null) => void) | null = null

let orderSeq = 0

function nextId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function formatRef(book: string, chapter: number, startV: number, endV?: number): string {
  return (
    book + ' ' + chapter + ':' + startV + (endV && endV > startV ? '-' + endV : '')
  ).toUpperCase()
}

function slideRefKey(slide: Slide): string {
  return slide.refs.join('|')
}

function canonicalBook(books: BookRef[], name: string): string {
  const lower = name.toLowerCase().replace(/^\d+\s+/, '').replace(/\s+/g, '')
  for (const b of books) {
    if (b.name.toLowerCase().replace(/\s+/g, '') === lower) return b.name
  }
  return name
}

export const useOperator = create<OperatorState>((set, get) => ({
  translations: [{ id: 'KJV', name: 'KJV' }],
  currentTranslation: 'KJV',

  verseData: {},
  verseCount: 0,
  lastChapter: { book: 'Genesis', chapter: 1 },
  browserTab: 'book',
  contextQuery: '',
  contextResults: [],

  schedule: [],
  scheduledRefs: [],
  staged: null,
  stagedEntryId: null,
  stagedFit: null,
  live: null,
  liveEntryId: null,
  isLive: false,

  monitorSlide: null,

  picks: [],

  blankMode: 'none',
  outputVisible: true,

  backgrounds: [],
  activeBackground: null,

  feed: [],
  lastPushAt: null,

  listeningStatus: 'idle',
  reconnectAttempts: 0,
  transcriptLines: [],

  alertsOpen: false,
  dgKeyOpen: false,

  loadTranslations: async () => {
    const list = await api.listTranslations()
    set({ translations: list })
  },

  deleteTranslation: async (id: string) => {
    await api.deleteTranslation(id)
    if (get().currentTranslation === id) {
      await get().switchTranslation('KJV')
    }
    await get().loadTranslations()
  },

  importTranslation: async () => {
    const result = await api.importTranslation()
    if (result) await get().loadTranslations()
  },

  switchTranslation: async (id: string) => {
    if (get().currentTranslation === id) return
    set({ currentTranslation: id })
    const { lastChapter } = get()
    if (lastChapter) await get().loadChapter(lastChapter.book, lastChapter.chapter, id)
  },

  loadChapter: async (book, chapter, translation) => {
    const s = get()
    const t = translation && translation !== s.currentTranslation ? translation : s.currentTranslation
    const verses = await api.getChapter(book, chapter, t)
    const total = (await api.getVerseCount(book, chapter, t)) ?? 0

    const verseData: Record<number, StageVerse> = {}
    for (const v of verses) {
      const ve = v.endVerse ?? v.verse
      verseData[v.verse] = {
        n: v.verse,
        endVerse: ve > v.verse ? ve : undefined,
        text: v.text,
        ref: formatRef(book, chapter, v.verse, ve),
        book,
        chapter,
      }
    }

    set({
      verseData,
      lastChapter: { book, chapter },
      verseCount: total || Object.keys(verseData).length,
      browserTab: 'book',
      currentTranslation: t,
      picks: [],
    })
  },

  navigateChapter: async (dir) => {
    const s = get()
    if (!s.lastChapter) return
    const books = await api.getBookList(s.currentTranslation)
    const curIdx = books.findIndex((b) => b.name === s.lastChapter!.book)
    if (curIdx === -1) return

    const isNext = dir > 0
    const newChapter = s.lastChapter.chapter + dir

    if (newChapter >= 1 && newChapter <= books[curIdx].chapters) {
      await get().loadChapter(s.lastChapter.book, newChapter)
    } else if (isNext) {
      const nextIdx = curIdx + 1 < books.length ? curIdx + 1 : 0
      await get().loadChapter(books[nextIdx].name, 1)
    } else {
      const prevIdx = curIdx - 1 >= 0 ? curIdx - 1 : books.length - 1
      await get().loadChapter(books[prevIdx].name, books[prevIdx].chapters)
    }
  },

  stageBibleVerse: async (book, chapter, verse, endVerse, translation) => {
    const s = get()
    const t = translation && translation !== s.currentTranslation ? translation : s.currentTranslation
    const verses = await api.getChapter(book, chapter, t)
    const ve = endVerse ?? verse
    const v = verses.find((x) => x.verse <= verse && verse <= (x.endVerse ?? x.verse))
    if (!v) return null
    const ref = formatRef(book, chapter, v.verse, v.endVerse ?? v.verse)
    const slide = verseSlide(ref, v.text)
    slide.refs = [formatRef(book, chapter, verse, ve)]
    return slide
  },

  setBrowserTab: (browserTab) => set({ browserTab, picks: [] }),
  setContextQuery: (contextQuery) => set({ contextQuery }),

  stageAndOpenRef: async (book, chapter, verse) => {
    const t = get().currentTranslation
    const bookName = canonicalBook(await api.getBookList(t), book)
    await get().loadChapter(bookName, chapter, t)
    const data = get().verseData
    const entries = Object.values(data)
    const target =
      verse && verse >= 1
        ? entries.find((x) => x.n <= verse && verse <= (x.endVerse ?? x.n))
        : entries[0]
    if (target) get().setStaged(verseSlide(target.ref, target.text), null)
  },

  stepStagedVerse: async (dir) => {
    const s = get()
    if (!s.staged) return
    const refs = (s.staged.refs ?? []).filter(Boolean)
    if (refs.length !== 1) return
    const m = refs[0].match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/)
    if (!m || !s.lastChapter) return

    const keys = Object.keys(s.verseData).map(Number).sort((a, b) => a - b)
    const idx = keys.indexOf(Number(m[3]))
    if (idx === -1) return

    if (dir > 0 && idx < keys.length - 1) {
      const entry = s.verseData[keys[idx + 1]]
      if (entry) get().setStaged(verseSlide(entry.ref, entry.text), null)
      return
    }
    if (dir < 0 && idx > 0) {
      const entry = s.verseData[keys[idx - 1]]
      if (entry) get().setStaged(verseSlide(entry.ref, entry.text), null)
      return
    }

    // chapter / book wrap
    const t = s.currentTranslation
    const chapterBooks = await api.getBookList(t)
    const book = canonicalBook(chapterBooks, m[1])
    const bookIdx = chapterBooks.findIndex((b) => b.name === book)
    if (bookIdx === -1) return
    if (dir > 0) {
      const newChapter = s.lastChapter.chapter + 1
      const curBook = chapterBooks[bookIdx]
      if (newChapter <= curBook.chapters) {
        await get().stageAndOpenRef(book, newChapter, 1)
      } else {
        const nextIdx = bookIdx + 1 < chapterBooks.length ? bookIdx + 1 : 0
        await get().stageAndOpenRef(chapterBooks[nextIdx].name, 1, 1)
      }
      return
    }
    const newChapter = s.lastChapter.chapter - 1
    const curBook = chapterBooks[bookIdx]
    if (newChapter >= 1) {
      const lastVerse = (await api.getVerseCount(book, newChapter, t)) ?? 1
      await get().stageAndOpenRef(book, newChapter, lastVerse)
    } else {
      const prevIdx = bookIdx - 1 >= 0 ? bookIdx - 1 : chapterBooks.length - 1
      const lastChap = chapterBooks[prevIdx].chapters
      const lastVerse =
        (await api.getVerseCount(chapterBooks[prevIdx].name, lastChap, t)) ?? 1
      await get().stageAndOpenRef(chapterBooks[prevIdx].name, lastChap, lastVerse)
    }
  },

  runContextSearch: async () => {
    const { contextQuery, currentTranslation } = get()
    const query = contextQuery.trim()
    if (!query) return
    const [lex, sem] = await Promise.all([
      api.searchVerses(query, currentTranslation).catch(() => []),
      api
        .paraphraseSearchAll(query, get().translations.map((tl) => tl.id))
        .catch(() => []),
    ])
    const results: ContextResult[] = []
    const seen = new Set<string>()
    const add = (ref: string, text: string, score?: number) => {
      if (seen.has(ref)) return
      seen.add(ref)
      results.push({ ref, text, score })
    }
    for (const r of sem.slice(0, 8)) {
      const ref = formatRef(r.book, r.chapter, r.verse, r.endVerse)
      add(ref, r.text, r.score)
    }
    for (const r of lex.slice(0, 8)) {
      const ref = formatRef(r.book, r.chapter, r.verse, r.endVerse)
      add(ref, r.text)
    }
    set({ contextResults: results, browserTab: 'context', picks: [] })
  },

  addToSchedule: (slide, src) => {
    orderSeq++
    const entry: ScheduleEntry = { id: nextId(), slide, src, order: orderSeq }
    const refs = slide.refs.filter(Boolean)
    set((s) => ({
      schedule: [entry, ...s.schedule],
      scheduledRefs: [...new Set([...s.scheduledRefs, ...refs])],
      staged: slide,
      stagedEntryId: entry.id,
      stagedFit: null,
    }))
  },

  removeFromSchedule: (id) => {
    set((s) => {
      const entry = s.schedule.find((e) => e.id === id)
      const refs = entry ? slideRefKey(entry.slide).split('|').filter(Boolean) : []
      const removed = s.schedule.filter((e) => e.id !== id)
      const remaining = new Set(removed.flatMap((e) => e.slide.refs))
      const scheduledRefs = s.scheduledRefs.filter((r) => remaining.has(r))
      return {
        schedule: removed,
        scheduledRefs,
        stagedEntryId: s.stagedEntryId === id ? null : s.stagedEntryId,
        liveEntryId: s.liveEntryId === id ? null : s.liveEntryId,
      }
    })
  },

  clearSchedule: () =>
    set({
      schedule: [],
      scheduledRefs: [],
      stagedEntryId: null,
      liveEntryId: null,
    }),

  setStaged: (slide, entryId) =>
    set({ staged: slide, stagedEntryId: entryId ?? null, stagedFit: null }),

  setStagedFit: (stagedFit) => set({ stagedFit }),

  previewStaged: () => {
    const { staged } = get()
    if (staged) set({ monitorSlide: staged })
  },

  goLive: () => {
    const { staged, stagedFit, currentTranslation, live } = get()
    if (!staged) return
    const push = {
      slide: staged,
      theme: staged.theme ?? 'default' as 'default',
      layout: staged.layout ?? 'single' as 'single',
      fontSize: stagedFit?.size ?? null,
    }
    set({
      live: staged,
      liveEntryId: get().stagedEntryId,
      monitorSlide: staged,
      isLive: true,
      lastPushAt: Date.now(),
      blankMode: 'none',
    })
    api.pushLive(push)
  },

  togglePick: (pick) => {
    const { picks } = get()
    const idx = picks.findIndex((p) => p.ref === pick.ref)
    if (idx === -1) {
      set({ picks: [...picks, pick].slice(-8) })
    } else {
      set({ picks: picks.filter((_, i) => i !== idx) })
    }
  },

  clearPicks: () => set({ picks: [] }),

  stackPicks: () => {
    const { picks, browserTab } = get()
    if (picks.length < 2) return
    const slide = stackSlide(picks.map((p) => ({ ref: p.ref, text: p.text })))
    if (!slide.refs.length) return
    get().addToSchedule(slide, browserTab === 'context' ? 'Context search' : 'Manual')
    set({ picks: [] })
  },

  toggleBlank: (mode) => {
    const next = get().blankMode === mode ? 'none' : mode
    set({ blankMode: next })
    api.setBlankMode(next)
  },
  toggleOutputVisibility: () => {
    set((s) => ({ outputVisible: !s.outputVisible }))
    api.toggleOutputVisibility()
  },

  loadBackgrounds: async () => {
    const backgrounds = await api.getBackgrounds()
    set({ backgrounds })
  },

  addBackground: async () => {
    const added = await api.importBackgrounds()
    if (added.length > 0) await get().loadBackgrounds()
  },

  deleteBackground: async (id) => {
    await api.deleteBackground(id)
    const item = get().backgrounds.find((b) => b.id === id)
    if (item && get().activeBackground?.fileName === item.fileName) {
      set({ activeBackground: null })
      await api.clearBackground()
    }
    await get().loadBackgrounds()
  },

  selectBackground: (src) => {
    set({ activeBackground: src })
    api.setBackground(src)
  },

  addDetection: async (input) => {
    const { currentTranslation, feed } = get()
    const t = input.translation || currentTranslation
    const vs = await api.getChapter(input.book, input.chapter, t)
    const verseObj = input.endVerse
      ? vs.find((v) => v.verse === input.verse && v.endVerse === input.endVerse)
      : vs.find((v) => v.verse <= input.verse && input.verse <= (v.endVerse ?? v.verse))
    if (!verseObj) return
    const startV = verseObj.verse
    const endV = verseObj.endVerse ?? startV
    const translationName = input.translationName ?? t
    const confPct = input.isParaphrase
      ? Math.max(1, Math.round((input.score ?? 0) * 100))
      : 100
    const card: DetectionCard = {
      id: nextId(),
      refStr: formatRef(input.book, input.chapter, startV, endV),
      tagText: input.isParaphrase
        ? 'Paraphrase' + (input.score != null ? ' \u00B7 ' + Math.round(input.score * 100) + '%' : '')
        : 'Reference',
      isParaphrase: input.isParaphrase,
      snippet: verseObj.text,
      book: input.book,
      chapter: input.chapter,
      verse: startV,
      translation: translationName,
      score: input.score,
      confPct,
      timeLabel: new Date().toTimeString().slice(0, 8),
    }
    set({ feed: [card, ...feed].slice(0, 40) })
  },

  clearFeed: () => set({ feed: [] }),

  setListeningStatus: (listeningStatus) => set({ listeningStatus }),
  setReconnectAttempts: (reconnectAttempts) => set({ reconnectAttempts }),

  commitTranscriptFinal: (text, refs) => {
    set((s) => {
      const lines = [...s.transcriptLines]
      const last = lines[lines.length - 1]
      if (last && !last.final) {
        lines[lines.length - 1] = { ...last, text: text.trim(), final: true, refs }
      } else {
        lines.push({
          id: nextId(),
          text: text.trim(),
          final: true,
          refs,
        })
      }
      return { transcriptLines: lines.slice(-MAX_TRANSCRIPT_LINES) }
    })
  },

  updateInterim: (text) => {
    set((s) => {
      const lines = [...s.transcriptLines]
      const last = lines[lines.length - 1]
      if (last && !last.final) {
        lines[lines.length - 1] = { ...last, text }
      } else {
        lines.push({ id: nextId(), text, final: false, refs: [] })
      }
      return { transcriptLines: lines.slice(-MAX_TRANSCRIPT_LINES) }
    })
  },

  clearTranscript: () => set({ transcriptLines: [] }),

  setAlertsOpen: (alertsOpen) => set({ alertsOpen }),
  sendAlert: (message) => {
    api.sendAlert(message)
    set({ alertsOpen: false })
  },

  openDgKeyPrompt: () => {
    const stored = sessionStorage.getItem('dgKey')
    if (stored) return Promise.resolve(stored)
    set({ dgKeyOpen: true })
    return new Promise<string | null>((resolve) => {
      dgResolve = resolve
    })
  },

  submitDgKey: (key) => {
    if (dgResolve) {
      dgResolve(key)
      dgResolve = null
    }
    set({ dgKeyOpen: false })
  },
}))