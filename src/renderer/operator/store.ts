import { create } from 'zustand'
import { api } from './api'
import type {
  StageVerse,
  OutputMode,
  BlankMode,
  ListeningStatus,
  LibraryTab,
  ScheduleItem,
  BgSource,
  DetectionCard,
  DetectionInput,
} from './types'
import type { BackgroundItem, BackgroundSource, TranslationInfo } from '../../shared/types'

export interface ChapterInfo {
  book: string
  chapter: number
}

interface OperatorState {
  // Translations
  translations: TranslationInfo[]
  currentTranslation: string

  // Chapter / filmstrip / staging
  verseData: Record<number, StageVerse>
  stagedVerse: StageVerse | null
  liveVerse: StageVerse | null
  verseCount: number
  lastChapter: ChapterInfo | null
  liveVerseNum: number | null
  isLive: boolean

  // Output
  outputMode: OutputMode
  blankMode: BlankMode
  clearOn: boolean
  outputVisible: boolean

  // Left panel
  activeTab: LibraryTab
  schedule: ScheduleItem[]
  activeScheduleId: string | null
  scheduleTitle: string
  scheduleRenamed: boolean

  // Backgrounds
  backgrounds: BackgroundItem[]
  activeBackground: BackgroundSource | null

  // Assistant
  feed: DetectionCard[]
  autoPush: boolean

  // Reading lock: suppresses paraphrase suggestions shortly after any push.
  lastPushAt: number | null

  // Listening
  listeningStatus: ListeningStatus
  reconnectAttempts: number
  transcript: string

  // Modals
  alertsOpen: boolean
  dgKeyOpen: boolean

  // Actions
  loadTranslations: () => Promise<void>
  switchTranslation: (id: string) => Promise<void>
  deleteTranslation: (id: string) => Promise<void>
  importTranslation: () => Promise<void>

  loadChapter: (book: string, chapter: number, startLive?: number, translation?: string) => Promise<number>
  loadAndStage: (book: string, chapter: number, verse: number, translation?: string) => Promise<number>
  stageVerse: (num: number) => void
  stepToVerse: (num: number) => void
  navigateChapter: (dir: number) => Promise<number | undefined>
  pushLive: () => void

  setOutputMode: (mode: OutputMode) => void
  toggleBlank: (mode: Exclude<BlankMode, 'none'>) => void
  toggleClear: () => void
  toggleOutputVisibility: () => void

  setActiveTab: (tab: LibraryTab) => void

  loadBackgrounds: () => Promise<void>
  addBackground: () => Promise<void>
  deleteBackground: (id: string) => Promise<void>
  selectBackground: (src: BackgroundSource) => void

  addSchedule: () => void
  selectSchedule: (id: string) => void

  addDetection: (input: DetectionInput) => Promise<void>
  toggleAutoPush: () => void

  setListeningStatus: (status: ListeningStatus) => void
  setReconnectAttempts: (n: number) => void
  setTranscript: (text: string) => void

  setAlertsOpen: (open: boolean) => void
  sendAlert: (message: string) => void

  openDgKeyPrompt: () => Promise<string | null>
  submitDgKey: (key: string | null) => void
}

export const READING_LOCK_MS = 30000

let dgResolve: ((key: string | null) => void) | null = null

function nextId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

function formatRef(book: string, chapter: number, startV: number, endV?: number): string {
  return (
    book + ' ' + chapter + ':' + startV + (endV && endV > startV ? '-' + endV : '')
  ).toUpperCase()
}

function formatVerseNum(n: number, endVerse?: number): string {
  return endVerse ? `${n}\u2013${endVerse}` : String(n)
}

const DEFAULT_SCHEDULE: ScheduleItem[] = [
  { id: 's_open', icon: 'music', name: 'Opening worship', sub: '4 songs' },
  { id: 's_sermon', icon: 'scripture', name: 'Sermon — Luke 1', sub: 'AI detection active', live: true },
  { id: 's_close', icon: 'music', name: 'Closing worship', sub: '2 songs' },
  { id: 's_ann', icon: 'slides', name: 'Announcements', sub: '3 slides' },
]

export const useOperator = create<OperatorState>((set, get) => ({
  translations: [{ id: 'KJV', name: 'KJV' }],
  currentTranslation: 'KJV',

  verseData: {},
  stagedVerse: null,
  liveVerse: null,
  verseCount: 0,
  lastChapter: null,
  liveVerseNum: null,
  isLive: false,

  outputMode: 'combined',
  blankMode: 'none',
  clearOn: false,
  outputVisible: true,

  activeTab: 'scripture',
  schedule: DEFAULT_SCHEDULE,
  activeScheduleId: 's_sermon',
  scheduleTitle: 'Order of service',
  scheduleRenamed: false,

  backgrounds: [],
  activeBackground: null,

  feed: [],
  autoPush: false,
  lastPushAt: null,

  listeningStatus: 'idle',
  reconnectAttempts: 0,
  transcript: '',

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
    const { stagedVerse } = get()
    if (stagedVerse) {
      await get().loadAndStage(stagedVerse.book, stagedVerse.chapter, stagedVerse.n, id)
    } else {
      await get().loadChapter('Luke', 1, 17, id)
    }
  },

  loadChapter: async (book, chapter, startLive = 1, translation) => {
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

    let live = startLive
    let staged = verseData[live]
    if (!staged) {
      const covered = Object.values(verseData).find((v) => v.n <= live && live <= (v.endVerse ?? v.n))
      if (covered) live = covered.n
      staged = verseData[live]
    }
    if (!staged) staged = Object.values(verseData)[0] ?? null

    set({
      verseData,
      stagedVerse: staged,
      liveVerse: null,
      liveVerseNum: staged ? staged.n : null,
      currentTranslation: t,
      isLive: true,
      lastChapter: { book, chapter },
      verseCount: total || Object.keys(verseData).length,
    })
    return live
  },

  loadAndStage: async (book, chapter, verse, translation) => {
    const resolved = await get().loadChapter(book, chapter, verse, translation)
    set({
      liveVerseNum: null,
      isLive: false,
      stagedVerse: get().verseData[resolved] ?? null,
    })
    return resolved
  },

  stageVerse: (num) => {
    const s = get()
    const v = s.verseData[num]
    if (!v) return
    const wasLive = num === s.liveVerseNum
    set({ stagedVerse: v, isLive: wasLive })
  },

  stepToVerse: (num) => {
    const v = get().verseData[num]
    if (!v) return
    set({ stagedVerse: v })
  },

  navigateChapter: async (dir) => {
    const s = get()
    if (!s.stagedVerse) return
    const books = await api.getBookList(s.currentTranslation)
    const curIdx = books.findIndex((b) => b.name === s.stagedVerse!.book)
    if (curIdx === -1) return

    const isNext = dir > 0
    const newChapter = s.stagedVerse.chapter + dir

    if (newChapter >= 1 && newChapter <= books[curIdx].chapters) {
      const verse = isNext
        ? 1
        : (await api.getVerseCount(s.stagedVerse.book, newChapter, s.currentTranslation)) ?? 1
      return get().loadAndStage(s.stagedVerse.book, newChapter, verse)
    } else if (isNext) {
      const nextIdx = curIdx + 1 < books.length ? curIdx + 1 : 0
      return get().loadAndStage(books[nextIdx].name, 1, 1)
    } else {
      const prevIdx = curIdx - 1 >= 0 ? curIdx - 1 : books.length - 1
      const lastChap = books[prevIdx].chapters
      const lastVerse = (await api.getVerseCount(books[prevIdx].name, lastChap, s.currentTranslation)) ?? 1
      return get().loadAndStage(books[prevIdx].name, lastChap, lastVerse)
    }
  },

  pushLive: () => {
    const { stagedVerse, currentTranslation } = get()
    if (!stagedVerse) return
    set({ liveVerseNum: stagedVerse.n, isLive: true, liveVerse: stagedVerse, blankMode: 'none', lastPushAt: Date.now() })
    api.pushLive({
      id: stagedVerse.ref,
      book: stagedVerse.book,
      chapter: stagedVerse.chapter,
      verse: stagedVerse.n,
      endVerse: stagedVerse.endVerse,
      text: stagedVerse.text,
      translation: currentTranslation,
      method: 'explicit',
      confidence: 1,
      transcriptSnippet: '',
      detectedAt: Date.now(),
    })
  },

  setOutputMode: (outputMode) => set({ outputMode }),
  toggleBlank: (mode) => {
    const next = get().blankMode === mode ? 'none' : mode
    set({ blankMode: next })
    api.setBlankMode(next)
  },
  toggleClear: () => {
    const next = !get().clearOn
    set({ clearOn: next })
    api.clearLive()
  },
  toggleOutputVisibility: () => {
    set((s) => ({ outputVisible: !s.outputVisible }))
    api.toggleOutputVisibility()
  },

  setActiveTab: (activeTab) => set({ activeTab }),

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

  addSchedule: () => {
    const { stagedVerse, schedule, scheduleRenamed, scheduleTitle } = get()
    if (!stagedVerse) return
    const title = scheduleRenamed ? scheduleTitle : 'Schedule'
    const item: ScheduleItem = {
      id: nextId(),
      icon: 'scripture',
      name: stagedVerse.ref,
      sub: 'Scripture',
    }
    set({ schedule: [item, ...schedule], scheduleTitle: title, scheduleRenamed: true })
  },

  selectSchedule: (id) => set({ activeScheduleId: id }),

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
    const card: DetectionCard = {
      id: nextId(),
      refStr: formatRef(input.book, input.chapter, startV, endV).toUpperCase(),
      tagText: input.isParaphrase
        ? 'Paraphrase' + (input.score != null ? ' \u00B7 ' + Math.round(input.score * 100) + '%' : '')
        : 'Reference',
      isParaphrase: input.isParaphrase,
      isTop: input.isTop,
      snippet: verseObj.text,
      book: input.book,
      chapter: input.chapter,
      verse: startV,
      translation: translationName,
      score: input.score,
      timeLabel: 'JUST NOW',
    }
    set({ feed: [card, ...feed] })

    if (get().autoPush && input.isTop && !input.isParaphrase) {
      await get().loadAndStage(card.book, card.chapter, card.verse, card.translation)
      get().pushLive()
    }
  },

  toggleAutoPush: () => set((s) => ({ autoPush: !s.autoPush })),

  setListeningStatus: (listeningStatus) => set({ listeningStatus }),
  setReconnectAttempts: (reconnectAttempts) => set({ reconnectAttempts }),
  setTranscript: (transcript) => set({ transcript }),

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

export { formatVerseNum }

export function verseLabel(v: StageVerse | null, count: number): string {
  if (!v) return ''
  return 'verse ' + formatVerseNum(v.n, v.endVerse) + ' of ' + count
}