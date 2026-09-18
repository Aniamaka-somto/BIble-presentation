import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC, type VerseMatch, type OutputState, type BlankMode,
  type BackgroundItem, type BackgroundSource, type TranslationInfo,
  type SemanticProgress,
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
  getChapter: (book: string, chapter: number, translation?: string) =>
    ipcRenderer.invoke(IPC.BIBLE_GET_CHAPTER, book, chapter, translation),
  searchVerses: (query: string, translation?: string) =>
    ipcRenderer.invoke(IPC.BIBLE_SEARCH, query, translation),
  phraseSearch: (query: string, translation?: string) =>
    ipcRenderer.invoke(IPC.BIBLE_PHRASE_SEARCH, query, translation),
  getBookList: (translation?: string) =>
    ipcRenderer.invoke(IPC.BIBLE_GET_BOOKS, translation),
  getVerseCount: (book: string, chapter: number, translation?: string) =>
    ipcRenderer.invoke(IPC.BIBLE_GET_VERSE_COUNT, book, chapter, translation) as Promise<number | null>,
  paraphraseSearch: (query: string, translation?: string) =>
    ipcRenderer.invoke(IPC.BIBLE_PARAPHRASE_SEARCH, query, translation),
  paraphraseSearchAll: (query: string, translations: string[]) =>
    ipcRenderer.invoke(IPC.BIBLE_PARAPHRASE_SEARCH_ALL, query, translations),
  getDesktopAudioSource: () => ipcRenderer.invoke(IPC.GET_DESKTOP_AUDIO_SOURCE) as Promise<DesktopSource | null>,
  toggleOutputVisibility: () => ipcRenderer.send(IPC.OUTPUT_TOGGLE_VISIBILITY),
  sendAlert: (message: string) => ipcRenderer.send(IPC.SEND_ALERT, message),
  listTranslations: () => ipcRenderer.invoke(IPC.TRANSLATIONS_LIST) as Promise<TranslationInfo[]>,
  importTranslation: () => ipcRenderer.invoke(IPC.TRANSLATION_IMPORT) as Promise<TranslationInfo[] | null>,
  deleteTranslation: (id: string) => ipcRenderer.invoke(IPC.TRANSLATION_DELETE, id) as Promise<TranslationInfo[]>,
  onOutputStateChanged: (callback: (state: OutputState) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: OutputState) => callback(state)
    ipcRenderer.on(IPC.OUTPUT_STATE_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.OUTPUT_STATE_CHANGED, listener)
  },
  onAlert: (callback: (message: string) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => callback(message)
    ipcRenderer.on(IPC.SEND_ALERT, listener)
    return () => ipcRenderer.removeListener(IPC.SEND_ALERT, listener)
  },
  onSemanticProgress: (callback: (progress: SemanticProgress) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: SemanticProgress) => callback(progress)
    ipcRenderer.on(IPC.SEMANTIC_PROGRESS, listener)
    return () => ipcRenderer.removeListener(IPC.SEMANTIC_PROGRESS, listener)
  }
})
