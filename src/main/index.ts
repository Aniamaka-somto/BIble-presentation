import { app, BrowserWindow, ipcMain, screen, desktopCapturer } from "electron";
import { join } from "path";
import {
  IPC,
  type VerseMatch,
  type OutputState,
  type BlankMode,
} from "../shared/types";
import { getChapter, smartSearch } from "../lib/bible";

let operatorWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;

const outputState: OutputState = {
  live: false,
  verse: null,
  blankMode: "none",
};

function createOperatorWindow() {
  operatorWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Scripture Caster — Operator Console",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    operatorWindow.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/operator/index.html`,
    );
  } else {
    operatorWindow.loadFile(join(__dirname, "../renderer/operator/index.html"));
  }
}

function createOutputWindow() {
  // Put it on a second display if one is available, otherwise open windowed
  // so it can still be captured as an OBS Window Source.
  const displays = screen.getAllDisplays();
  const target =
    displays.find((d) => d.id !== screen.getPrimaryDisplay().id) ?? displays[0];

  outputWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    fullscreen: displays.length > 1,
    title: "Scripture Caster — Live Output",
    backgroundColor: "#0c0a08",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    outputWindow.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/output/index.html`,
    );
  } else {
    outputWindow.loadFile(join(__dirname, "../renderer/output/index.html"));
  }
}

app.whenReady().then(() => {
  createOperatorWindow();
  createOutputWindow();

  // Operator pushes a detected verse live -> broadcast new state to the output window.
  ipcMain.on(IPC.VERSE_PUSH_LIVE, (_event, verse: VerseMatch) => {
    outputState.live = true;
    outputState.verse = verse;
    outputState.blankMode = "none";
    outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
  });

  ipcMain.on(IPC.VERSE_CLEAR, () => {
    outputState.live = false;
    outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
  });

  // LOGO/BLACK/CLEAR — this is what actually blanks the real projector/OBS
  // output, not just a visual toggle in the operator's own window.
  ipcMain.on(IPC.SET_BLANK_MODE, (_event, mode: BlankMode) => {
    outputState.blankMode = mode;
    outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
  });

  // Real Bible lookups — backed by the full local KJV corpus (31,102 verses),
  // not a hardcoded demo set. Renderer asks, main process answers.
  ipcMain.handle(
    IPC.BIBLE_GET_CHAPTER,
    (_event, book: string, chapter: number) => {
      return getChapter(book, chapter);
    },
  );
  ipcMain.handle(IPC.BIBLE_SEARCH, (_event, query: string) => {
    return smartSearch(query, 20);
  });

  ipcMain.handle(IPC.GET_DESKTOP_AUDIO_SOURCE, async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 0, height: 0 },
    });
    if (sources.length === 0) return null;
    return { id: sources[0].id, name: sources[0].name };
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOperatorWindow();
      createOutputWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
