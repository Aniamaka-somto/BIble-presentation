import {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
  dialog,
  protocol,
  net,
  powerSaveBlocker,
} from "electron";
import { join, extname, basename } from "path";
import { pathToFileURL } from "url";
import * as fs from "fs/promises";
import {
  IPC,
  type VerseMatch,
  type OutputState,
  type BlankMode,
  type BackgroundItem,
  type BackgroundSource,
} from "../shared/types";
import {
  getChapter,
  smartSearch,
  phraseSearch,
  paraphraseSearch,
  getBookList,
  setTranslationsDir,
  listTranslations,
  importTranslation,
  deleteTranslation,
  getTraditionalCount,
} from "../lib/bible";

let operatorWindow: BrowserWindow | null = null;
let outputWindow: BrowserWindow | null = null;
let sleepBlockerId: number | null = null;
const backgroundsDir = join(app.getPath("userData"), "backgrounds");
const metaPath = join(backgroundsDir, "meta.json");

const outputState: OutputState = {
  live: false,
  verse: null,
  blankMode: "none",
  background: null,
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

  operatorWindow.on("close", () => {
    if (outputWindow) {
      outputWindow.destroy();
      outputWindow = null;
    }
  });
}

let outputDisplayId: number | null = null; // Keep track of which monitor we are on

function createOutputWindow() {
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const target =
    displays.length > 1 ? displays.find((d) => d.id !== primary.id)! : primary;

  outputWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false, // NO title bar
    fullscreen: true, // FORCE fullscreen
    skipTaskbar: true,
    resizable: false,
    focusable: true, // Keep true so you can Alt-F4 if needed
    alwaysOnTop: true,
    title: "Scripture Caster — Live Output",
    backgroundColor: "#0a0b0f",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Lock dimensions
  outputWindow.setMaximumSize(target.bounds.width, target.bounds.height);
  outputWindow.setMinimumSize(target.bounds.width, target.bounds.height);

  // Hide cursor
  outputWindow.webContents.on("did-finish-load", () => {
    outputWindow?.webContents.insertCSS(`
      html, body { 
        cursor: none !important; 
        user-select: none !important;
      }
    `);
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    outputWindow.loadURL(
      `${process.env.ELECTRON_RENDERER_URL}/output/index.html`,
    );
  } else {
    outputWindow.loadFile(join(__dirname, "../renderer/output/index.html"));
  }
}
// ---- Background helpers ----
async function ensureBackgroundsDir() {
  try {
    await fs.mkdir(backgroundsDir, { recursive: true });
  } catch {
    /* ok */
  }
}

async function readMeta(): Promise<BackgroundItem[]> {
  try {
    const raw = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeMeta(items: BackgroundItem[]) {
  await fs.writeFile(metaPath, JSON.stringify(items, null, 2), "utf-8");
}

async function importFiles(srcPaths: string[]): Promise<BackgroundItem[]> {
  await ensureBackgroundsDir();
  const meta = await readMeta();
  const added: BackgroundItem[] = [];

  for (const src of srcPaths) {
    const ext = extname(src).toLowerCase();
    const type = [".mp4", ".mov", ".webm"].includes(ext) ? "video" : "image";
    if (
      type === "image" &&
      ![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)
    )
      continue;

    const id = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const destName = `${id}${ext}`;
    await fs.copyFile(src, join(backgroundsDir, destName));

    added.push({
      id,
      name: basename(src),
      type,
      fileName: destName,
      addedAt: Date.now(),
    });
  }

  const updated = [...meta, ...added];
  await writeMeta(updated);
  return added;
}

app.whenReady().then(async () => {
  await ensureBackgroundsDir();
  setTranslationsDir(join(app.getPath("userData"), "translations"));

  // Prevent display sleep while output is active (e.g. during a service)
  sleepBlockerId = powerSaveBlocker.start("prevent-display-sleep");

  // bg:// protocol serves background media files
  protocol.handle("bg", (request) => {
    const fileName = decodeURIComponent(request.url.slice("bg://".length));
    return net.fetch(pathToFileURL(join(backgroundsDir, fileName)).href);
  });

  createOperatorWindow();
  createOutputWindow();

  // --- PROJECTOR MANAGEMENT ---
  // If the projector is unplugged, hide the output window so it doesn't float on the main screen
  screen.on("display-removed", (_event, oldDisplay) => {
    if (outputWindow && oldDisplay.id === outputDisplayId) {
      outputWindow.hide();
      // Optional: Send an IPC to your operator console to show a "Projector disconnected" warning
      // operatorWindow?.webContents.send("projector-disconnected");
    }
  });

  // If the projector is plugged back in, restore the output window to it
  screen.on("display-added", (_event, newDisplay) => {
    if (
      outputWindow &&
      !outputWindow.isVisible() &&
      newDisplay.id === outputDisplayId
    ) {
      outputWindow.setBounds(newDisplay.bounds);
      outputWindow.setMaximumSize(
        newDisplay.bounds.width,
        newDisplay.bounds.height,
      );
      outputWindow.setMinimumSize(
        newDisplay.bounds.width,
        newDisplay.bounds.height,
      );
      outputWindow.show();
    }
  });

  // ---- Verse / blank IPC (unchanged) ----
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

  ipcMain.on(IPC.OUTPUT_TOGGLE_VISIBILITY, () => {
    if (!outputWindow) return;
    if (outputWindow.isVisible()) {
      outputWindow.hide();
    } else {
      outputWindow.show();
    }
  });

  ipcMain.on(IPC.SEND_ALERT, (_event, message: string) => {
    outputWindow?.webContents.send(IPC.SEND_ALERT, message);
  });

  ipcMain.on(IPC.SET_BLANK_MODE, (_event, mode: BlankMode) => {
    outputState.blankMode = mode;
    outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
  });

  // ---- Background IPC ----
  ipcMain.handle(IPC.SET_BACKGROUND, (_event, source: BackgroundSource) => {
    outputState.background = source;
    outputState.blankMode = "none";
    outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
  });

  ipcMain.handle(IPC.CLEAR_BACKGROUND, () => {
    outputState.background = null;
    outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
  });

  ipcMain.handle(IPC.BACKGROUNDS_LIST, async () => {
    return readMeta();
  });

  ipcMain.handle(IPC.BACKGROUNDS_IMPORT, async () => {
    const result = await dialog.showOpenDialog(operatorWindow!, {
      properties: ["openFile", "multiSelections"],
      filters: [
        {
          name: "Images & Videos",
          extensions: [
            "jpg",
            "jpeg",
            "png",
            "gif",
            "webp",
            "mp4",
            "mov",
            "webm",
          ],
        },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return [];
    return importFiles(result.filePaths);
  });

  ipcMain.handle(IPC.BACKGROUNDS_DELETE, async (_event, id: string) => {
    const meta = await readMeta();
    const idx = meta.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const [item] = meta.splice(idx, 1);
    await writeMeta(meta);
    try {
      await fs.unlink(join(backgroundsDir, item.fileName));
    } catch {
      /* ok */
    }

    if (outputState.background?.fileName === item.fileName) {
      outputState.background = null;
      outputWindow?.webContents.send(IPC.OUTPUT_STATE_CHANGED, outputState);
    }
  });

  // ---- Bible IPC ----
  ipcMain.handle(
    IPC.BIBLE_GET_CHAPTER,
    (_event, book: string, chapter: number, translation?: string) => {
      return getChapter(book, chapter, translation);
    },
  );
  ipcMain.handle(IPC.BIBLE_SEARCH, (_event, query: string, translation?: string) => {
    return smartSearch(query, 20, translation);
  });

  ipcMain.handle(IPC.BIBLE_PHRASE_SEARCH, (_event, query: string, translation?: string) => {
    return phraseSearch(query, 10, translation);
  });

  ipcMain.handle(IPC.BIBLE_GET_BOOKS, (_event, translation?: string) => {
    return getBookList(translation);
  });

  ipcMain.handle(IPC.BIBLE_GET_VERSE_COUNT, (_event, book: string, chapter: number, translation?: string) => {
    return getTraditionalCount(book, chapter, translation) ?? null;
  });

  ipcMain.handle(IPC.BIBLE_PARAPHRASE_SEARCH, (_event, query: string, translation?: string) => {
    return paraphraseSearch(query, 5, 0.4, translation);
  });

  ipcMain.handle(IPC.GET_DESKTOP_AUDIO_SOURCE, async () => {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 0, height: 0 },
    });
    if (sources.length === 0) return null;
    return { id: sources[0].id, name: sources[0].name };
  });

  // ---- Translation IPC ----
  ipcMain.handle(IPC.TRANSLATIONS_LIST, () => {
    return listTranslations();
  });

  ipcMain.handle(IPC.TRANSLATION_IMPORT, async () => {
    const result = await dialog.showOpenDialog(operatorWindow!, {
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Bible Translations", extensions: ["json"] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    for (const filePath of result.filePaths) {
      const raw = JSON.parse(await fs.readFile(filePath, "utf-8"));
      const id = basename(filePath, extname(filePath));
      const verses = Array.isArray(raw) ? raw : raw.data;
      importTranslation(id, verses, Array.isArray(raw) ? void 0 : raw.verse_counts);
    }
    return listTranslations();
  });

  ipcMain.handle(IPC.TRANSLATION_DELETE, (_event, id: string) => {
    deleteTranslation(id);
    return listTranslations();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOperatorWindow();
      createOutputWindow();
    } else {
      operatorWindow?.show();
    }
  });
});

app.on("before-quit", () => {
  if (sleepBlockerId != null && powerSaveBlocker.isStarted(sleepBlockerId)) {
    powerSaveBlocker.stop(sleepBlockerId);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
