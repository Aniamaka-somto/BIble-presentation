import type { Slide } from '../../shared/types'

export type BlankMode = 'none' | 'logo' | 'black'

export type ListeningStatus =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'reconnecting'
  | 'offline'
  | 'error'

export type BrowserTab = 'book' | 'context'

export interface StageVerse {
  n: number
  endVerse?: number
  text: string
  ref: string
  book: string
  chapter: number
}

export interface ScheduleEntry {
  id: string
  slide: Slide
  src: string
  order: number
}

export interface TranscriptLine {
  id: string
  text: string
  final: boolean
  refs: { book: string; matchedText: string }[]
}

export interface DetectionCard {
  id: string
  refStr: string
  tagText: string
  isParaphrase: boolean
  snippet: string
  book: string
  chapter: number
  verse: number
  translation: string
  score?: number
  confPct: number
  timeLabel: string
}

export interface DetectionInput {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  snippet: string
  isTop: boolean
  isParaphrase: boolean
  score?: number
  translation: string
  translationName?: string
}

export interface VersePick {
  ref: string
  text: string
}

export interface ContextResult {
  ref: string
  text: string
  score?: number
}