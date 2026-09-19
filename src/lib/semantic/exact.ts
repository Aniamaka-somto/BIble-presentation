import { getAllVerses, type BibleVerse, type ParaphraseMatch } from "../bible";
import { SEARCH_PRIORITY } from "./index";

export interface ExactResult extends ParaphraseMatch {
  translation: string;
  exact: true;
}

const MIN_WORDS = 4;
const MAX_WORDS = 14;
const MAX_CANDIDATES = 2000;
const RUN_AT_LEAST = 4;
const MAX_INDEXED = 6;

// Normalize for matching: NFC-normalized, diacritics removed, apostrophes
// dropped ("priest's office" == "priests office"), everything else word-ized.
function normText(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019`']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

interface ExactIndex {
  verses: BibleVerse[];
  texts: string[];
  keys: string[];
  byKey: Map<string, number>;
  postings: Map<string, number[]>;
}

const indexCache = new Map<string, ExactIndex>();

function cacheIndex(translation: string, idx: ExactIndex): ExactIndex {
  if (indexCache.size >= MAX_INDEXED) {
    const oldest = indexCache.keys().next().value;
    if (typeof oldest === "string") indexCache.delete(oldest);
  }
  indexCache.set(translation, idx);
  return idx;
}

function buildIndex(translation: string): ExactIndex {
  const cached = indexCache.get(translation);
  if (cached) return cached;

  const verses = getAllVerses(translation);
  const texts: string[] = [];
  const keys: string[] = [];
  const byKey = new Map<string, number>();
  const postings = new Map<string, number[]>();
  for (let i = 0; i < verses.length; i++) {
    const v = verses[i];
    const n = normText(v.text);
    texts.push(` ${n} `);
    const key = `${v.book}|${v.chapter}|${v.verse}`;
    keys.push(key);
    byKey.set(key, i);
    const seen = new Set<string>();
    for (const w of n.split(" ")) {
      if (!w || seen.has(w)) continue;
      seen.add(w);
      let arr = postings.get(w);
      if (!arr) postings.set(w, (arr = []));
      arr.push(i);
    }
  }
  return cacheIndex(translation, { verses, texts, keys, byKey, postings });
}

function includesSorted(arr: number[], v: number): boolean {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo < arr.length && arr[lo] === v;
}

// Longest contiguous run of the spoken words found verbatim inside a verse.
function longestRun(verseText: string, words: string[]): number {
  for (let len = Math.min(words.length, MAX_WORDS); len >= RUN_AT_LEAST; len--) {
    for (let start = 0; start + len <= words.length; start++) {
      if (verseText.includes(` ${words.slice(start, start + len).join(" ")} `)) {
        return len;
      }
    }
  }
  return 0;
}

/**
 * Word-for-word exact search, run ahead of any semantic scoring. It finds
 * verses that contain the spoken utterance as a verbatim run (the longest
 * window of >= RUN_AT_LEAST words), ranked by how much of the utterance the
 * run covers. Postings for the 3 rarest shared words narrow the scan, so the
 * whole pass is a few thousand substring checks — no embedding required.
 */
export function exactSearch(
  utterance: string,
  translations: string[],
  preferredTranslation: string,
  limit = 4,
): ExactResult[] {
  if (!utterance) return [];
  const words = normText(utterance).split(" ").filter(Boolean);
  if (words.length < MIN_WORDS || words.length > MAX_WORDS) return [];
  const tail = words.slice(-MAX_WORDS);

  const scored = [...new Set([preferredTranslation, ...SEARCH_PRIORITY])].filter(
    (t) => translations.includes(t),
  );
  if (scored.length === 0) return [];
  const indexList = scored.map((t) => ({ translation: t, idx: buildIndex(t) }));

  const primary = indexList[0].idx;

  // Use the 3 rarest words the utterance shares with the preferred index as
  // anchors, then intersect (binary search) their posting lists to bound the
  // candidate pool to MAX_CANDIDATES.
  const present = tail.filter((w) => (primary.postings.get(w)?.length ?? 0) > 0);
  if (present.length < 3) return [];
  const anchors = present
    .map((w) => ({ w, size: primary.postings.get(w)!.length }))
    .sort((a, b) => a.size - b.size)
    .slice(0, 3)
    .map((a) => a.w);

  let cands: number[] | null = null;
  for (const w of anchors) {
    const arr = primary.postings.get(w)!;
    if (cands === null) {
      cands = arr.slice(0, MAX_CANDIDATES);
    } else {
      cands = cands.filter((i) => includesSorted(arr, i));
    }
    if (cands.length === 0) break;
  }
  if (!cands || cands.length === 0) return [];

  // Verse ordering differs between translations, so map each candidate
  // through book|chapter|verse before matching text in the other indexes.
  const bestByKey = new Map<string, ExactResult>();
  for (const i of cands) {
    const key = primary.keys[i];
    if (!key) continue;
    for (const { translation, idx } of indexList) {
      const j = idx.byKey.get(key);
      if (j === undefined) continue;
      const run = longestRun(idx.texts[j], tail);
      if (run < RUN_AT_LEAST) continue;
      const v = idx.verses[j];
      const score = run / tail.length;
      const existing = bestByKey.get(key);
      const entry: ExactResult = {
        ...v,
        score: Math.round(score * 10000) / 10000,
        translation,
        exact: true,
      };
      if (
        !existing ||
        score > existing.score ||
        (score === existing.score && translation === preferredTranslation)
      ) {
        bestByKey.set(key, entry);
      }
    }
  }

  return [...bestByKey.values()]
    .sort((a, b) => b.score - a.score || a.text.length - b.text.length)
    .slice(0, limit);
}