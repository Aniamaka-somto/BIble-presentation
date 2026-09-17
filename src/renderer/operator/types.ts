import type { BackgroundType, TranslationInfo } from '../../shared/types'

export interface StageVerse {
  n: number
  endVerse?: number
  text: string
  ref: string
  book: string
  chapter: number
}

export type OutputMode = 'combined' | 'split'

export type BlankMode = 'none' | 'logo' | 'black'

export type ListeningStatus =
  | 'idle'
  | 'initializing'
  | 'listening'
  | 'reconnecting'
  | 'offline'
  | 'error'

export type LibraryTab = 'scripture' | 'songs' | 'media' | 'web' | 'themes'

export type ScheduleIcon = 'music' | 'scripture' | 'slides'

export interface ScheduleItem {
  id: string
  icon: ScheduleIcon
  name: string
  sub: string
  live?: boolean
}

export interface BgSource {
  type: BackgroundType
  fileName: string
}

export interface DetectionCard {
  id: string
  refStr: string
  tagText: string
  isParaphrase: boolean
  isTop: boolean
  snippet: string
  book: string
  chapter: number
  verse: number
  translation: string
  score?: number
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

export type { TranslationInfo }