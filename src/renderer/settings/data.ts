export type SettingsPage = 'display' | 'output' | 'settings'

export const DISPLAY_DEFAULTS = {
  preset: 'classic',
  font: 'serif',
  color: '#eef3fb',
  bg: '#070a11',
  ref: '#4d8dff',
  align: 'center',
  lh: 1.32,
  minFs: 30,
  maxFs: 96,
  safeX: 130,
  safeY: 100,
  refPos: 'below',
  showNums: true,
  shadow: false,
} as const

export interface DisplaySettings {
  preset: string
  font: string
  color: string
  bg: string
  ref: string
  align: 'left' | 'center'
  lh: number
  minFs: number
  maxFs: number
  safeX: number
  safeY: number
  refPos: 'below' | 'above' | 'hidden'
  showNums: boolean
  shadow: boolean
}

export const PRESETS: Record<
  string,
  { name: string; bg: string; color: string; ref: string; font: string }
> = {
  classic: { name: 'Classic', bg: '#070a11', color: '#eef3fb', ref: '#4d8dff', font: 'serif' },
  paper: { name: 'Paper', bg: '#f4efe4', color: '#1d1b18', ref: '#8a5a12', font: 'serif' },
  royal: { name: 'Royal', bg: '#0b1f4d', color: '#ffffff', ref: '#8fb6ff', font: 'serif' },
  contrast: { name: 'Contrast', bg: '#000000', color: '#ffffff', ref: '#ffe066', font: 'sans' },
  chroma: { name: 'Chroma key', bg: '#00b140', color: '#ffffff', ref: '#ffffff', font: 'sans' },
}

export const FONT_CSS: Record<string, string> = {
  serif: "var(--serif)",
  sans: "var(--sans)",
  georgia: "Georgia, serif",
}

export interface DisplayInfo {
  id: number
  name: string
  w: number
  h: number
  hz: number
  scale: number
  role: string
}

export const DISPLAYS_SEED: DisplayInfo[] = [
  { id: 1, name: 'Built-in Display', w: 1920, h: 1080, hz: 60, scale: 100, role: 'console' },
  { id: 2, name: 'Projector · HDMI 1', w: 1920, h: 1080, hz: 60, scale: 100, role: 'main' },
  { id: 3, name: 'Stage Monitor · HDMI 2', w: 1280, h: 720, hz: 60, scale: 100, role: 'stage' },
]

export const ROLE_LABEL: Record<string, string> = {
  console: 'Console',
  main: 'Main output',
  stage: 'Stage display',
  stream: 'Livestream',
  off: 'Off',
}

export interface Store {
  display: DisplaySettings
  ui: { sample: 'short' | 'long' | 'stack' }
  out: {
    main: { fit: string; overscan: number; onLoss: string; onTop: boolean; hideCursor: boolean; awake: boolean }
    stage: { current: boolean; next: boolean; clock: boolean; timer: boolean; transcript: boolean }
    stream: { bg: string; layout: string }
    launch: { openOutputs: boolean }
  }
  set: {
    general: { church: string; service: string; confirmLive: boolean; autoClear: string }
    audio: { device: string; key: string; lang: string; threshold: number; mode: string; keep: number; repeat: string }
    bible: { primary: string; extra: { bsb: boolean; asv: boolean; net: boolean }; showLabel: boolean }
    keys: Record<string, string>
  }
}

export const OUT_DEFAULTS: Store['out'] = {
  main: { fit: 'letterbox', overscan: 0, onLoss: 'hold', onTop: true, hideCursor: true, awake: true },
  stage: { current: true, next: true, clock: true, timer: false, transcript: false },
  stream: { bg: 'transparent', layout: 'full' },
  launch: { openOutputs: true },
}

export const SET_DEFAULTS: Store['set'] = {
  general: { church: '', service: 'Sunday Service', confirmLive: false, autoClear: 'never' },
  audio: { device: 'x32-4', key: '', lang: 'en-US', threshold: 80, mode: 'list', keep: 20, repeat: '30' },
  bible: { primary: 'kjv', extra: { bsb: false, asv: false, net: false }, showLabel: true },
  keys: { goLive: 'Enter', next: '↓', prev: '↑', clear: 'C', black: 'B', logo: 'L', mic: 'T', search: '/' },
}

export const SHORTCUTS: Array<[string, string, string]> = [
  ['goLive', 'Go live', 'Send the staged slide to the screens'],
  ['next', 'Next in schedule', ''],
  ['prev', 'Previous in schedule', ''],
  ['clear', 'Clear text', 'Keeps the background'],
  ['black', 'Black screen', ''],
  ['logo', 'Show logo', ''],
  ['mic', 'Start or stop transcribing', ''],
  ['search', 'Focus verse search', ''],
]

export const DEFAULT_KEYS = SET_DEFAULTS.keys

// Demo sample verses for the Display settings preview (Genesis 1, KJV).
export const SAMPLE_VERSES: Array<[number, string]> = [
  [1, 'In the beginning God created the heaven and the earth.'],
  [2, 'And the earth was without form, and void; and darkness was upon the face of the deep. And the Spirit of God moved upon the face of the waters.'],
  [3, 'And God said, Let there be light: and there was light.'],
  [4, 'And God saw the light, that it was good: and God divided the light from the darkness.'],
  [5, 'And God called the light Day, and the darkness he called Night. And the evening and the morning were the first day.'],
  [6, 'And God said, Let there be a firmament in the midst of the waters, and let it divide the waters from the waters.'],
]

export const LONGEST = SAMPLE_VERSES[1]

export function snap<T>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T
}

export function setPath(o: unknown, p: string, v: unknown) {
  const ks = p.split('.')
  const last = ks.pop()!
  const obj = ks.reduce((a, k) => a as Record<string, unknown>, o as Record<string, unknown>) as Record<string, unknown>
  obj[last] = v
}

export function getPath(o: unknown, p: string): unknown {
  return p.split('.').reduce((a, k) => (a == null ? a : (a as Record<string, unknown>)[k]), o)
}