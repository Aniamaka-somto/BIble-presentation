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
  vectors: Float32Array;
  buffer?: Buffer;
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
  const vectors = new Float32Array(parsed.count * DIM);
  for (let i = 0; i < parsed.count; i++) {
    const scale = buf.readFloatLE(i * 4);
    const off = i * DIM;
    const base = parsed.count * 4 + off;
    for (let j = 0; j < DIM; j++) {
      vectors[off + j] = buf.readInt8(base + j) * scale;
    }
  }
  return { sourceStamp: BUNDLED_STAMP, verses, vectors };
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
  if (existing) {
    const currentStamp = getTranslationStamp(translation);
    if (
      existing.sourceStamp === BUNDLED_STAMP ||
      existing.sourceStamp === currentStamp
    ) {
      return existing;
    }
  }

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
    const off = i * DIM;
    let dot = 0;
    for (let j = 0; j < DIM; j++) dot += q[j] * index.vectors[off + j];
    if (dot >= threshold) {
      const v = index.verses[i];
      results.push({ ...v, score: Math.round(dot * 10000) / 10000 });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Embed the query exactly once, then score it against every translation index
 * in a single pass. Avoids N redundant forward passes and concurrent
 * session.run() on the shared onnxruntime pipeline.
 */
export async function semanticSearchAll(
  query: string,
  translations: string[],
  limit = 8,
  threshold = 0.5,
): Promise<(ParaphraseMatch & { translation: string })[]> {
  const pipe = await ensureModel();
  const out = await pipe(query, { pooling: "mean", normalize: true });
  const q = out.data as Float32Array;

  const results: (ParaphraseMatch & { translation: string })[] = [];
  for (const translation of translations) {
    const index = await ensureIndex(translation);
    if (!index) continue;
    const n = index.verses.length;
    for (let i = 0; i < n; i++) {
      const off = i * DIM;
      let dot = 0;
      for (let j = 0; j < DIM; j++) dot += q[j] * index.vectors[off + j];
      if (dot >= threshold) {
        const v = index.verses[i];
        results.push({ ...v, score: Math.round(dot * 10000) / 10000, translation });
      }
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}
