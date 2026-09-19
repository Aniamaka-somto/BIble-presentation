export type DetectionMethod = 'explicit' | 'semantic'
export type BlankMode = 'none' | 'logo' | 'black'
export type BackgroundType = 'image' | 'video'

export interface VerseMatch {
  id: string
  book: string
  chapter: number
  verse: number
  endVerse?: number
  text: string
  translation: string
  method: DetectionMethod
  confidence: number
  transcriptSnippet: string
  detectedAt: number
}

export interface TranscriptChunk {
  text: string
  isFinal: boolean
  timestamp: number
}

export interface BackgroundSource {
  type: BackgroundType
  fileName: string
}

export interface BackgroundItem {
  id: string
  name: string
  type: BackgroundType
  fileName: string
  addedAt: number
}

// A slide is a declarative scene: one or more text blocks, each with its own
// reference. Rendered on a fixed 1920x1080 canvas, auto-fitted once, then
// scaled to whatever box displays it (operator preview, operator live monitor,
// projector window). The main process only ever carries this state — never
// pixels or HTML.
export type SlideTheme = 'default' // single theme for now, carried for the future
export type SlideLayout = 'single' // single layout for now, carried for the future

export interface SlidePart {
  text: string
  num?: number
}

export interface SlideBlock {
  ref: string
  parts: SlidePart[]
}

export interface Slide {
  label: string
  refs: string[]
  blocks: SlideBlock[]
  theme?: SlideTheme
  layout?: SlideLayout
}

// Payload pushed to the output window. fontSize is the operator's authoritative
// auto-fit size (canvas px), so every display is pixel-identical.
export interface LiveSlidePush {
  slide: Slide
  theme: SlideTheme
  layout: SlideLayout
  fontSize: number | null
}

export interface OutputState {
  live: boolean
  slide: Slide | null
  theme: SlideTheme
  layout: SlideLayout
  fontSize: number | null
  blankMode: BlankMode
  background: BackgroundSource | null
}

export interface TranslationInfo {
  id: string
  name: string
}

export interface BibleVerseRef {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  text: string
}

export interface ParaphraseMatchRef extends BibleVerseRef {
  score: number
}

export interface BookRef {
  name: string
  chapters: number
}

export type SemanticPhase = 'idle' | 'download' | 'indexing' | 'ready' | 'error'

export interface SemanticProgress {
  phase: SemanticPhase
  translation?: string
  done: number
  total: number
  detail?: string
}

// Full surface of window.scriptureCaster (exposed by the preload bridge).
export interface ScriptureCasterApi {
  pushLive(push: LiveSlidePush): void
  clearLive(): void
  setBlankMode(mode: BlankMode): void
  setBackground(source: BackgroundSource): Promise<void>
  clearBackground(): Promise<void>
  getBackgrounds(): Promise<BackgroundItem[]>
  importBackgrounds(): Promise<BackgroundItem[]>
  deleteBackground(id: string): Promise<void>
  getChapter(book: string, chapter: number, translation?: string): Promise<BibleVerseRef[]>
  searchVerses(query: string, translation?: string): Promise<BibleVerseRef[]>
  phraseSearch(query: string, translation?: string): Promise<BibleVerseRef[]>
  getBookList(translation?: string): Promise<BookRef[]>
  getVerseCount(book: string, chapter: number, translation?: string): Promise<number | null>
  paraphraseSearch(query: string, translation?: string): Promise<ParaphraseMatchRef[]>
  paraphraseSearchAll(query: string, translations: string[]): Promise<ParaphraseMatchRef[]>
  getDesktopAudioSource(): Promise<{ id: string; name: string } | null>
  toggleOutputVisibility(): void
  sendAlert(message: string): void
  listTranslations(): Promise<TranslationInfo[]>
  importTranslation(): Promise<TranslationInfo[] | null>
  deleteTranslation(id: string): Promise<TranslationInfo[]>
  onOutputStateChanged(cb: (state: OutputState) => void): () => void
  onAlert(cb: (message: string) => void): () => void
  onSemanticProgress(cb: (progress: SemanticProgress) => void): () => void
}

export const IPC = {
  TRANSCRIPT_CHUNK: 'transcript:chunk',
  VERSE_DETECTED: 'verse:detected',
  VERSE_PUSH_LIVE: 'verse:push-live',
  VERSE_CLEAR: 'verse:clear',
  SET_BLANK_MODE: 'output:set-blank-mode',
  SET_BACKGROUND: 'output:set-background',
  CLEAR_BACKGROUND: 'output:clear-background',
  OUTPUT_STATE_CHANGED: 'output:state-changed',
  BIBLE_GET_CHAPTER: 'bible:get-chapter',
  BIBLE_SEARCH: 'bible:search',
  BIBLE_PHRASE_SEARCH: 'bible:phrase-search',
  BIBLE_GET_BOOKS: 'bible:get-books',
  GET_DESKTOP_AUDIO_SOURCE: 'desktop:get-audio-source',
  BIBLE_PARAPHRASE_SEARCH: 'bible:paraphrase-search',
  BIBLE_PARAPHRASE_SEARCH_ALL: 'bible:paraphrase-search-all',
  BACKGROUNDS_LIST: 'backgrounds:list',
  BACKGROUNDS_IMPORT: 'backgrounds:import',
  BACKGROUNDS_DELETE: 'backgrounds:delete',
  OUTPUT_TOGGLE_VISIBILITY: 'output:toggle-visibility',
  SEND_ALERT: 'output:send-alert',
  TRANSLATIONS_LIST: 'translations:list',
  TRANSLATION_IMPORT: 'translation:import',
  TRANSLATION_DELETE: 'translation:delete',
  TRANSLATION_SELECT: 'translation:select',
  BIBLE_GET_VERSE_COUNT: 'bible:get-verse-count',
  SEMANTIC_PROGRESS: 'semantic:progress',
} as const
