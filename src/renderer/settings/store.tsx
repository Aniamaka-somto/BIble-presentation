import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { DISPLAY_DEFAULTS, OUT_DEFAULTS, SET_DEFAULTS, snap, type Store } from './data'

function initialStore(): Store {
  return {
    display: snap(DISPLAY_DEFAULTS),
    ui: { sample: 'short' },
    out: snap(OUT_DEFAULTS),
    set: snap(SET_DEFAULTS),
  }
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

export interface StoreApi {
  store: Store
  commit: (path: string, value: unknown) => void
  resetSection: (path: string) => void
  setDisplaySlice: (patch: Partial<Store['display']>) => void
  setOutSlice: (patch: Partial<Store['out']>) => void
  setSetSlice: (patch: Partial<Store['set']>) => void
  setDisplays: React.Dispatch<React.SetStateAction<DisplayInfo[]>>
  displays: DisplayInfo[]
}

const StoreCtx = createContext<StoreApi | null>(null)

const SEED_DISPLAYS: DisplayInfo[] = [
  { id: 1, name: 'Built-in Display', w: 1920, h: 1080, hz: 60, scale: 100, role: 'console' },
  { id: 2, name: 'Projector · HDMI 1', w: 1920, h: 1080, hz: 60, scale: 100, role: 'main' },
  { id: 3, name: 'Stage Monitor · HDMI 2', w: 1280, h: 720, hz: 60, scale: 100, role: 'stage' },
]

export function StoreProvider({
  children,
  initial,
}: {
  children: ReactNode
  initial?: { store?: Store; displays?: DisplayInfo[] }
}) {
  const [displays, setDisplays] = useState<DisplayInfo[]>(initial?.displays ?? SEED_DISPLAYS)
  const [store, setStore] = useState<Store>(initial?.store ?? (initialStore() as Store))

  const commit = useCallback((path: string, value: unknown) => {
    const keys = path.split('.')
    setStore((s) => {
      const next = snap(s)
      const last = keys.pop()!
      const obj = keys.reduce<Record<string, unknown>>(
        (acc, k) => acc[k] as Record<string, unknown>,
        next as unknown as Record<string, unknown>,
      )
      obj[last] = value
      return next
    })
  }, [])

  const resetSection = useCallback((path: string) => {
    const key = path.split('.')[0] as keyof Store
    const defaults =
      key === 'display'
        ? snap(DISPLAY_DEFAULTS)
        : key === 'out'
          ? snap(OUT_DEFAULTS)
          : snap(SET_DEFAULTS)
    setStore((s) => ({ ...s, [key]: defaults }))
  }, [])

  const setDisplaySlice = useCallback((patch: Partial<Store['display']>) => {
    setStore((s) => ({ ...s, display: { ...s.display, ...patch } }))
  }, [])
  const setOutSlice = useCallback((patch: Partial<Store['out']>) => {
    setStore((s) => ({ ...s, out: { ...s.out, ...patch } }))
  }, [])
  const setSetSlice = useCallback((patch: Partial<Store['set']>) => {
    setStore((s) => ({ ...s, set: { ...s.set, ...patch } }))
  }, [])

  return (
    <StoreCtx.Provider
      value={{ store, commit, resetSection, setDisplaySlice, setOutSlice, setSetSlice, setDisplays, displays }}
    >
      {children}
    </StoreCtx.Provider>
  )
}

export function useStoreApi(): StoreApi {
  const ctx = useContext(StoreCtx)
  if (!ctx) throw new Error('useStoreApi outside StoreProvider')
  return ctx
}