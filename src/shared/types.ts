export type DetectionMethod = 'explicit' | 'semantic'
export type BlankMode = 'none' | 'logo' | 'black'

export interface VerseMatch {
  id: string
  book: string
  chapter: number
  verse: number
  endVerse?: number
  text: string
  translation: 'KJV'
  method: DetectionMethod
  confidence: number // 0-1, mainly meaningful for semantic matches
  transcriptSnippet: string
  detectedAt: number // epoch ms
}

export interface TranscriptChunk {
  text: string
  isFinal: boolean
  timestamp: number
}

export interface OutputState {
  live: boolean
  verse: VerseMatch | null
  blankMode: BlankMode
}

// Channel names shared across main/preload/renderer so they can't drift.
export const IPC = {
  TRANSCRIPT_CHUNK: 'transcript:chunk',
  VERSE_DETECTED: 'verse:detected',
  VERSE_PUSH_LIVE: 'verse:push-live',
  VERSE_CLEAR: 'verse:clear',
  SET_BLANK_MODE: 'output:set-blank-mode',
  OUTPUT_STATE_CHANGED: 'output:state-changed',
  BIBLE_GET_CHAPTER: 'bible:get-chapter',
  BIBLE_SEARCH: 'bible:search',
  GET_DESKTOP_AUDIO_SOURCE: 'desktop:get-audio-source'
} as const

