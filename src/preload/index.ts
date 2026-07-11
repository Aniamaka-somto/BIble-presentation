import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC, type VerseMatch, type OutputState, type BlankMode,
  type BackgroundItem, type BackgroundSource,
} from '../shared/types'

interface DesktopSource {
  id: string
  name: string
}

contextBridge.exposeInMainWorld('scriptureCaster', {
  pushLive: (verse: VerseMatch) => ipcRenderer.send(IPC.VERSE_PUSH_LIVE, verse),
  clearLive: () => ipcRenderer.send(IPC.VERSE_CLEAR),
  setBlankMode: (mode: BlankMode) => ipcRenderer.send(IPC.SET_BLANK_MODE, mode),
  setBackground: (source: BackgroundSource) => ipcRenderer.invoke(IPC.SET_BACKGROUND, source),
  clearBackground: () => ipcRenderer.invoke(IPC.CLEAR_BACKGROUND),
  getBackgrounds: () => ipcRenderer.invoke(IPC.BACKGROUNDS_LIST) as Promise<BackgroundItem[]>,
  importBackgrounds: () => ipcRenderer.invoke(IPC.BACKGROUNDS_IMPORT) as Promise<BackgroundItem[]>,
  deleteBackground: (id: string) => ipcRenderer.invoke(IPC.BACKGROUNDS_DELETE, id),
  getChapter: (book: string, chapter: number) => ipcRenderer.invoke(IPC.BIBLE_GET_CHAPTER, book, chapter),
  searchVerses: (query: string) => ipcRenderer.invoke(IPC.BIBLE_SEARCH, query),
  phraseSearch: (query: string) => ipcRenderer.invoke(IPC.BIBLE_PHRASE_SEARCH, query),
  getBookList: () => ipcRenderer.invoke(IPC.BIBLE_GET_BOOKS),
  paraphraseSearch: (query: string) => ipcRenderer.invoke(IPC.BIBLE_PARAPHRASE_SEARCH, query),
  getDesktopAudioSource: () => ipcRenderer.invoke(IPC.GET_DESKTOP_AUDIO_SOURCE) as Promise<DesktopSource | null>,
  toggleOutputVisibility: () => ipcRenderer.send(IPC.OUTPUT_TOGGLE_VISIBILITY),
  onOutputStateChanged: (callback: (state: OutputState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: OutputState) => callback(state)
    ipcRenderer.on(IPC.OUTPUT_STATE_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.OUTPUT_STATE_CHANGED, listener)
  }
})
