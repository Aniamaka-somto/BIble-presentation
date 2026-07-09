import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type VerseMatch, type OutputState, type BlankMode } from '../shared/types'

interface DesktopSource {
  id: string
  name: string
}

contextBridge.exposeInMainWorld('scriptureCaster', {
  pushLive: (verse: VerseMatch) => ipcRenderer.send(IPC.VERSE_PUSH_LIVE, verse),
  clearLive: () => ipcRenderer.send(IPC.VERSE_CLEAR),
  setBlankMode: (mode: BlankMode) => ipcRenderer.send(IPC.SET_BLANK_MODE, mode),
  getChapter: (book: string, chapter: number) => ipcRenderer.invoke(IPC.BIBLE_GET_CHAPTER, book, chapter),
  searchVerses: (query: string) => ipcRenderer.invoke(IPC.BIBLE_SEARCH, query),
  getDesktopAudioSource: () => ipcRenderer.invoke(IPC.GET_DESKTOP_AUDIO_SOURCE) as Promise<DesktopSource | null>,
  onOutputStateChanged: (callback: (state: OutputState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: OutputState) => callback(state)
    ipcRenderer.on(IPC.OUTPUT_STATE_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.OUTPUT_STATE_CHANGED, listener)
  }
})
