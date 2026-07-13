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

export interface OutputState {
  live: boolean
  verse: VerseMatch | null
  blankMode: BlankMode
  background: BackgroundSource | null
}

export interface TranslationInfo {
  id: string
  name: string
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
  BACKGROUNDS_LIST: 'backgrounds:list',
  BACKGROUNDS_IMPORT: 'backgrounds:import',
  BACKGROUNDS_DELETE: 'backgrounds:delete',
  OUTPUT_TOGGLE_VISIBILITY: 'output:toggle-visibility',
  SEND_ALERT: 'output:send-alert',
  TRANSLATIONS_LIST: 'translations:list',
  TRANSLATION_IMPORT: 'translation:import',
  TRANSLATION_DELETE: 'translation:delete',
  TRANSLATION_SELECT: 'translation:select',
} as const
