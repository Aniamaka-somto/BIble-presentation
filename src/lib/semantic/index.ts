import path from "path";
import fs from "fs";
import type { FeatureExtractionPipeline } from "@xenova/transformers";
import {
  getAllVerses,
  getTranslationStamp,
  type BibleVerse,
  type ParaphraseMatch,
} from "../bible";

export type SemanticPhase =
  | "idle"
  | "download"
  | "indexing"
  | "ready"
  | "error";

export interface SemanticProgress {
  phase: SemanticPhase;
  translation?: string;
  done: number;
  total: number;
  detail?: string;
}

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const MODEL_SHORT = "all-MiniLM-L6-v2";
const QUANTIZED = true;
const BATCH = 128;
const DIM = 384;

// Translations that get full dot-product scoring on every search. Everything
// else is resolved by verse-key text lookup, so the full set of translations
// still appears in results without the 21x scan that caused the UI freeze.
export const SEARCH_PRIORITY = ["KJV", "NKJV", "AMP"];
const MAX_SCORED = 4;

let baseCacheDir = "";
let modelDir = "";
let bundledIndexDir = "";
let modelPhase: SemanticPhase = "idle";
let modelError = "";
let embedder: FeatureExtractionPipeline | null = null;
let progressListener: ((p: SemanticProgress) => void) | null = null;

type Tx = typeof import("@xenova/transformers");
let tx: Tx | null = null;
let txPromise: Promise<Tx> | null = null;

function applyEnv(m: Tx) {
  if (modelDir) {
    m.env.cacheDir = modelDir;
    m.env.allowRemoteModels = false;
  } else if (baseCacheDir) {
    m.env.cacheDir = path.join(baseCacheDir, "models");
  }
}

function loadTx(): Promise<Tx> {
  if (tx) return Promise.resolve(tx);
  if (!txPromise) {
    txPromise = import("@xenova/transformers").then((m) => {
      tx = m;
      applyEnv(m);
      return m;
    });
  }
  return txPromise;
}

interface LoadedIndex {
  sourceStamp: string;
  verses: BibleVerse[];
  vectors?: Float32Array;
  buffer?: Buffer;
  int8?: Int8Array;
  scales?: Float32Array;
}

const indexCache = new Map<string, LoadedIndex>();
const building = new Map<string, Promise<void>>();

function emit(p: SemanticProgress) {
  progressListener?.(p);
}

export function setSemanticCacheDir(dir: string) {
  baseCacheDir = dir;
  if (tx) applyEnv(tx);
}

export function setSemanticModelDir(dir: string) {
  modelDir = dir;
  if (tx) applyEnv(tx);
}

export function setBundledIndexDir(dir: string) {
  bundledIndexDir = dir;
}

export function onSemanticProgress(
  listener: (p: SemanticProgress) => void,
): () => void {
  progressListener = listener;
  return () => {
    if (progressListener === listener) progressListener = null;
  };
}

export function semanticStatus(): { phase: SemanticPhase; error: string } {
  return { phase: modelPhase, error: modelError };
}

async function ensureModel(): Promise<FeatureExtractionPipeline> {
  if (embedder) return embedder;
  if (!modelDir && !baseCacheDir) throw new Error("Semantic cache dir not configured");
  if (modelPhase === "error") throw new Error(modelError);
  modelPhase = "download";
  emit({
    phase: "download",
    done: 0,
    total: 1,
    detail: "Downloading semantic model…",
  });
  try {
    const m = await loadTx();
    embedder = await m.pipeline("feature-extraction", MODEL_ID, {
      quantized: QUANTIZED,
      progress_callback: (p: {
        status?: string;
        progress?: number;
        file?: string;
      }) => {
        emit({
          phase: "download",
          done: Math.round((p.progress ?? 0) * 100),
          total: 100,
          detail: p.file
            ? `Downloading ${p.file}…`
            : "Downloading semantic model…",
        });
      },
    });
    modelPhase = "ready";
    emit({ phase: "ready", done: 1, total: 1, detail: "Semantic model ready" });
    return embedder;
  } catch (err) {
    modelPhase = "error";
    modelError = String(err);
    emit({ phase: "error", done: 0, total: 1, detail: String(err) });
    throw err;
  }
}

function indexPaths(translation: string): { bin: string; meta: string } {
  return {
    bin: path.join(baseCacheDir, "index", `${translation}.${MODEL_SHORT}.f32`),
    meta: path.join(
      baseCacheDir,
      "index",
      `${translation}.${MODEL_SHORT}.json`,
    ),
  };
}

function bundledIndexPaths(translation: string): { bin: string; meta: string } {
  return {
    bin: path.join(bundledIndexDir, `${translation}.${MODEL_SHORT}.int8`),
    meta: path.join(bundledIndexDir, `${translation}.${MODEL_SHORT}.json`),
  };
}

const BUNDLED_STAMP = "bundled-v1";

function loadBundledIndex(
  translation: string,
  verses: BibleVerse[],
): LoadedIndex | null {
  if (!bundledIndexDir) return null;
  const { bin, meta } = bundledIndexPaths(translation);
  if (!fs.existsSync(meta) || !fs.existsSync(bin)) return null;
  let parsed: {
    format: string;
    dim: number;
    count: number;
    stamp: string;
  };
  try {
    parsed = JSON.parse(fs.readFileSync(meta, "utf-8"));
  } catch {
    return null;
  }
  if (
    parsed.format !== "int8" ||
    parsed.dim !== DIM ||
    parsed.count !== verses.length
  ) {
    return null;
  }
  const buf = fs.readFileSync(bin);
  if (buf.length < parsed.count * (4 + DIM)) return null;
  // Zero-copy: view the int8 data and its per-verse f32 scale without
  // dequantizing to a full Float32Array (48MB saved per translation).
  const int8 = new Int8Array(buf.buffer, buf.byteOffset + parsed.count * 4, parsed.count * DIM);
  const scales = new Float32Array(buf.buffer, buf.byteOffset, parsed.count);
  return { sourceStamp: BUNDLED_STAMP, verses, int8, scales };
}

function loadIndexFromDisk(
  translation: string,
  stamp: string,
): LoadedIndex | null {
  const { bin, meta } = indexPaths(translation);
  if (!fs.existsSync(meta) || !fs.existsSync(bin)) return null;
  let parsed: { stamp: string; dim: number; count: number };
  try {
    parsed = JSON.parse(fs.readFileSync(meta, "utf-8"));
  } catch {
    return null;
  }
  if (parsed.stamp !== stamp || parsed.dim !== DIM) return null;
  const verses = getAllVerses(translation);
  if (verses.length !== parsed.count) return null;
  const buffer = fs.readFileSync(bin);
  if (buffer.length < parsed.count * DIM * 4) return null;
  return {
    sourceStamp: stamp,
    verses,
    buffer,
    vectors: new Float32Array(
      buffer.buffer,
      buffer.byteOffset,
      parsed.count * DIM,
    ),
  };
}

async function saveIndex(
  translation: string,
  stamp: string,
  vectors: Float32Array,
) {
  const { bin, meta } = indexPaths(translation);
  await fs.promises.mkdir(path.dirname(bin), { recursive: true });
  await fs.promises.writeFile(bin, Buffer.from(vectors.buffer as ArrayBuffer));
  await fs.promises.writeFile(
    meta,
    JSON.stringify({ stamp, dim: DIM, count: vectors.length / DIM }),
  );
}

async function buildIndex(
  translation: string,
  stamp: string,
): Promise<LoadedIndex> {
  const verses = getAllVerses(translation);
  const vectors = new Float32Array(verses.length * DIM);
  const pipe = embedder!;
  emit({
    phase: "indexing",
    translation,
    done: 0,
    total: verses.length,
    detail: `Indexing ${translation}…`,
  });
  for (let i = 0; i < verses.length; i += BATCH) {
    const slice = verses.slice(i, i + BATCH);
    const labels = slice.map((v) => v.text);
    const out = (await pipe(labels, {
      pooling: "mean",
      normalize: true,
    })) as unknown as {
      data: Float32Array;
    };
    const data = out.data;
    for (let j = 0; j < slice.length; j++) {
      vectors.set(data.subarray(j * DIM, (j + 1) * DIM), (i + j) * DIM);
    }
    emit({
      phase: "indexing",
      translation,
      done: Math.min(i + BATCH, verses.length),
      total: verses.length,
    });
  }
  await saveIndex(translation, stamp, vectors);
  return {
    sourceStamp: stamp,
    verses,
    vectors,
  };
}

async function ensureIndex(
  translation: string,
  options: { allowBuild?: boolean } = {},
): Promise<LoadedIndex | null> {
  const existing = indexCache.get(translation);
  if (existing) return existing;

  const verses = getAllVerses(translation);
  const bundled = loadBundledIndex(translation, verses);
  if (bundled) {
    indexCache.set(translation, bundled);
    return bundled;
  }

  const stamp = getTranslationStamp(translation);
  const cached = loadIndexFromDisk(translation, stamp);
  if (cached) {
    indexCache.set(translation, cached);
    return cached;
  }

  if (!options.allowBuild) return null;

  const inflight = building.get(translation);
  if (inflight) {
    await inflight;
    return indexCache.get(translation)!;
  }

  const p = (async () => {
    try {
      const built = await buildIndex(translation, stamp);
      indexCache.set(translation, built);
    } finally {
      building.delete(translation);
    }
  })();
  building.set(translation, p);
  await p;
  return indexCache.get(translation)!;
}

export async function ensureSemanticReady(): Promise<void> {
  await ensureModel();
}

export async function warmSemanticIndexes(translations: string[]): Promise<void> {
  for (const translation of translations) {
    await ensureIndex(translation);
  }
}

// Dot product of query q against verse i. Handles both Float32 vectors
// (self-built / on-disk f32) and zero-copy int8 + per-verse scale (bundled).
function rowDot(index: LoadedIndex, i: number, q: Float32Array): number {
  const off = i * DIM;
  if (index.vectors) {
    const vec = index.vectors;
    let dot = 0;
    for (let j = 0; j < DIM; j++) dot += q[j] * vec[off + j];
    return dot;
  }
  const int8 = index.int8!;
  const scale = index.scales![i];
  let dot = 0;
  for (let j = 0; j < DIM; j++) dot += q[j] * int8[off + j];
  return dot * scale;
}

// Cached verse-key -> text maps used to fill in translations that aren't
// dot-product scored (avoids re-reading the bible data on every search).
const textMapCache = new Map<string, Map<string, BibleVerse>>();
function getTextMap(translation: string): Map<string, BibleVerse> {
  let m = textMapCache.get(translation);
  if (!m) {
    m = new Map();
    for (const v of getAllVerses(translation)) {
      m.set(`${v.book}|${v.chapter}|${v.verse}`, v);
    }
    textMapCache.set(translation, m);
  }
  return m;
}

export async function semanticSearch(
  query: string,
  limit = 8,
  threshold = 0.5,
  translation = "KJV",
): Promise<ParaphraseMatch[]> {
  const pipe = await ensureModel();
  const index = await ensureIndex(translation);
  if (!index) return [];

  const out = await pipe(query, { pooling: "mean", normalize: true });
  const q = out.data as Float32Array;

  const results: ParaphraseMatch[] = [];
  const n = index.verses.length;
  for (let i = 0; i < n; i++) {
    const dot = rowDot(index, i, q);
    if (dot >= threshold) {
      const v = index.verses[i];
      results.push({ ...v, score: Math.round(dot * 10000) / 10000 });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Embed the query exactly once, then score it against a small set of
 * translations (preferred + canonical fallbacks) in a single pass, resolving
 * the other requested translations by verse-key text lookup. This keeps every
 * translation in the results without the full 21x scan that froze the UI.
 */
export async function semanticSearchAll(
  query: string,
  translations: string[],
  limit = 8,
  threshold = 0.5,
  preferred = "KJV",
): Promise<(ParaphraseMatch & { translation: string })[]> {
  if (translations.length === 0) return [];
  const pipe = await ensureModel();
  const out = await pipe(query, { pooling: "mean", normalize: true });
  const q = out.data as Float32Array;

  const scored: string[] = [];
  for (const t of [preferred, ...SEARCH_PRIORITY, ...translations]) {
    if (t && !scored.includes(t)) scored.push(t);
  }
  if (scored.length > MAX_SCORED) scored.length = MAX_SCORED;

  const results: (ParaphraseMatch & { translation: string })[] = [];
  for (const translation of scored) {
    const index = await ensureIndex(translation);
    if (!index) continue;
    const n = index.verses.length;
    for (let i = 0; i < n; i++) {
      const dot = rowDot(index, i, q);
      if (dot >= threshold) {
        const v = index.verses[i];
        results.push({ ...v, score: Math.round(dot * 10000) / 10000, translation });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  const top = results.slice(0, limit);

  const scoredSet = new Set(scored);
  const filled: (ParaphraseMatch & { translation: string })[] = [...top];
  for (const m of top) {
    const key = `${m.book}|${m.chapter}|${m.verse}`;
    for (const t of translations) {
      if (scoredSet.has(t)) continue;
      const v = getTextMap(t).get(key);
      if (v) filled.push({ ...m, text: v.text, translation: t });
    }
  }
  return filled;
}
