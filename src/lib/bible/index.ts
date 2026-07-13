import path from "path";
import fs from "fs";
import kjv from "./kjv.json";

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
  endVerse?: number;
}

export interface ParaphraseMatch extends BibleVerse {
  score: number;
}

export interface BookInfo {
  name: string;
  chapters: number;
}

export interface TranslationInfo {
  id: string;
  name: string;
}

interface TranslationData {
  verses: BibleVerse[];
  chapterIndex: Map<string, BibleVerse[]>;
  bookList: BookInfo[];
  traditionalCounts?: Map<string, number>;
}

const cache = new Map<string, TranslationData>();
let translationsDir = "";

const kjvCounts = new Map<string, number>();
(function buildKjvCounts() {
  for (const v of kjv as BibleVerse[]) {
    const key = `${v.book}|${v.chapter}`;
    const cur = kjvCounts.get(key) ?? 0;
    if (v.verse > cur) kjvCounts.set(key, v.verse);
  }
})();

export function setTranslationsDir(dir: string) {
  translationsDir = dir;
}

function translationsPath(): string {
  if (!translationsDir) {
    translationsDir = path.join(
      process.env.APPDATA ||
        process.env.XDG_CONFIG_HOME ||
        path.join(process.env.HOME || "/tmp", ".config"),
      "scripture-caster",
      "translations",
    );
  }
  return translationsDir;
}

function computeCount(book: string, chapter: number, translation: string): number | undefined {
  const data = cache.get(translation);
  if (!data) return undefined;
  const key = `${book} ${chapter}`;
  const ch = data.chapterIndex.get(key);
  if (!ch || ch.length === 0) return undefined;
  let max = 0;
  for (const v of ch) {
    const end = v.endVerse ?? v.verse;
    if (end > max) max = end;
  }
  return max;
}

export function getTraditionalCount(
  book: string,
  chapter: number,
  translation = "KJV",
): number | undefined {
  const data = cache.get(translation);
  if (data?.traditionalCounts) {
    const c = data.traditionalCounts.get(`${book}|${chapter}`);
    if (c !== undefined) return c;
  }
  const computed = computeCount(book, chapter, translation);
  if (computed !== undefined) return computed;
  return kjvCounts.get(`${book}|${chapter}`);
}

function detectCombined(
  verses: BibleVerse[],
  traditionalCounts?: Map<string, number>,
): void {
  const chapters = new Map<string, BibleVerse[]>();
  for (const v of verses) {
    const key = `${v.book}|${v.chapter}`;
    if (!chapters.has(key)) chapters.set(key, []);
    chapters.get(key)!.push(v);
  }
  for (const [, ch] of chapters) {
    ch.sort((a, b) => a.verse - b.verse);
    for (let i = 0; i < ch.length; i++) {
      const cur = ch[i];
      const next = ch[i + 1];
      if (next && next.verse > cur.verse + 1) {
        cur.endVerse = next.verse - 1;
      }
    }
    if (traditionalCounts && ch.length > 0) {
      const last = ch[ch.length - 1];
      const bk = `${last.book}|${last.chapter}`;
      const maxExpected = traditionalCounts.get(bk);
      if (maxExpected && (last.endVerse ?? last.verse) < maxExpected) {
        last.endVerse = maxExpected;
      }
    }
  }
}

function buildData(verses: BibleVerse[], counts?: Map<string, number>): TranslationData {
  const copy: BibleVerse[] = verses.map((v) => ({ ...v }));
  detectCombined(copy, counts);
  const chapterIndex = new Map<string, BibleVerse[]>();
  for (const v of copy) {
    const key = `${v.book} ${v.chapter}`;
    if (!chapterIndex.has(key)) chapterIndex.set(key, []);
    chapterIndex.get(key)!.push(v);
  }
  const seen = new Map<string, number>();
  for (const v of copy) {
    const cur = seen.get(v.book) ?? 0;
    if (v.chapter > cur) seen.set(v.book, v.chapter);
  }
  const bookList: BookInfo[] = [];
  const done = new Set<string>();
  for (const v of copy) {
    if (!done.has(v.book)) {
      bookList.push({ name: v.book, chapters: seen.get(v.book)! });
      done.add(v.book);
    }
  }
  return { verses: copy, chapterIndex, bookList, traditionalCounts: counts };
}

function getTranslation(name: string): TranslationData {
  let data = cache.get(name);
  if (data) return data;
  if (name === "KJV") {
    data = buildData(kjv as BibleVerse[]);
    cache.set("KJV", data);
    return data;
  }
  const filePath = path.join(translationsPath(), `${name}.json`);
  if (!fs.existsSync(filePath)) {
    return cache.get("KJV")!;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  const verses: BibleVerse[] = Array.isArray(raw) ? raw : raw.data;
  let vc: Map<string, number> | undefined;
  if (!Array.isArray(raw) && raw.verse_counts) {
    vc = new Map<string, number>();
    for (const [book, counts] of Object.entries(raw.verse_counts as Record<string, number[]>)) {
      counts.forEach((c, i) => {
        const key = `${book}|${i + 1}`;
        const kjv = kjvCounts.get(key) ?? 0;
        vc!.set(key, Math.max(c, kjv));
      });
    }
  }
  data = buildData(verses, vc);
  data.traditionalCounts = vc;
  cache.set(name, data);
  return data;
}

export function getChapter(
  book: string,
  chapter: number,
  translation = "KJV",
): BibleVerse[] {
  return getTranslation(translation).chapterIndex.get(`${book} ${chapter}`) ?? [];
}

export function getVerse(
  book: string,
  chapter: number,
  verse: number,
  translation = "KJV",
): BibleVerse | undefined {
  return getChapter(book, chapter, translation).find(
    (v) => v.verse <= verse && verse <= (v.endVerse ?? v.verse),
  );
}

export function lookupReference(
  ref: string,
  translation = "KJV",
): BibleVerse[] {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return [];
  const [, book, chapterStr, startStr, endStr] = match;
  const chapter = parseInt(chapterStr, 10);
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : start;
  return getChapter(book.trim(), chapter, translation).filter(
    (v) => {
      const ve = v.endVerse ?? v.verse;
      return v.verse <= end && ve >= start;
    },
  );
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','up','down','out','off','over','under','again','further',
  'then','once','here','there','when','where','why','how','all','each',
  'every','both','few','more','most','other','some','such','no','nor',
  'not','only','own','same','so','than','too','very','because',
  'as','until','while','about','against','between','into','through',
  'during','before','after','above','below','is','was','were','be',
  'been','being','have','has','had','do','does','did','will','would',
  'can','could','should','may','might','must','i','you','he',
  'she','it','we','they','me','him','her','us','them','my','your',
  'his','its','our','their','mine','yours','hers','ours','theirs',
  'this','that','these','those','am','art','dost','doth','didst','hath',
  'thou','thee','thy','thine','ye','unto','upon','hast','hadst','shalt',
  'wilt','canst','couldst','wouldst','shouldst','mightst','mayest',
]);

const STEM_SUFFIXES: [string, string][] = [
  ['eth', 'e'],
  ['est', 'e'],
  ['ing', 'e'],
  ['ed', 'e'],
  ['st', ''],
  ['s', ''],
];

function stem(word: string): string {
  for (const [suffix, append] of STEM_SUFFIXES) {
    if (word.endsWith(suffix) && word.length > suffix.length + 1) {
      return word.slice(0, -suffix.length) + append;
    }
  }
  return word;
}

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map(stem);
}

export function paraphraseSearch(
  query: string,
  limit = 5,
  threshold = 0.4,
  translation = "KJV",
): ParaphraseMatch[] {
  const { verses } = getTranslation(translation);
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const normQuery = norm(query);
  if (normQuery.length >= 3) {
    const exact: ParaphraseMatch[] = [];
    for (const v of verses) {
      if (norm(v.text).includes(normQuery)) {
        exact.push({ ...v, score: 1 });
        if (exact.length >= limit) break;
      }
    }
    if (exact.length > 0) return exact;
  }

  const queryWords = tokenize(query);
  if (queryWords.length < 3) return [];

  const minMatches = Math.ceil(queryWords.length * 0.4);
  const maxSpan = queryWords.length * 5;
  const results: ParaphraseMatch[] = [];
  for (const v of verses) {
    const verseTokenized = tokenize(v.text);
    const verseWords = new Set(verseTokenized);
    let matches = 0;
    const matchPositions: number[] = [];
    for (const w of queryWords) {
      if (verseWords.has(w)) {
        matches++;
        matchPositions.push(verseTokenized.indexOf(w));
      }
    }
    if (matches < minMatches) continue;
    const rawScore = matches / queryWords.length;
    let orderBonus = 1;
    let proximityBonus = 1;
    if (matchPositions.length >= 2) {
      let inOrder = true;
      for (let i = 1; i < matchPositions.length; i++) {
        if (matchPositions[i] < matchPositions[i - 1]) {
          inOrder = false;
          break;
        }
      }
      if (!inOrder) orderBonus = 0.7;
      const span = Math.max(...matchPositions) - Math.min(...matchPositions);
      proximityBonus = 0.6 + 0.4 * Math.max(0, 1 - span / Math.max(1, maxSpan));
    }
    const adjusted = rawScore * orderBonus * proximityBonus;
    const score = Math.round(adjusted * adjusted * 100) / 100;
    if (score >= threshold) {
      results.push({ ...v, score });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function getBookList(translation = "KJV"): BookInfo[] {
  return getTranslation(translation).bookList;
}

export function searchText(
  query: string,
  limit = 20,
  translation = "KJV",
): BibleVerse[] {
  const q = query.toLowerCase();
  const { verses } = getTranslation(translation);
  const results: BibleVerse[] = [];
  for (const v of verses) {
    if (v.text.toLowerCase().includes(q)) {
      results.push(v);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export function phraseSearch(
  query: string,
  limit = 10,
  translation = "KJV",
): BibleVerse[] {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const q = norm(query);
  if (q.length < 3) return [];
  const { verses } = getTranslation(translation);
  const results: BibleVerse[] = [];
  for (const v of verses) {
    if (norm(v.text).includes(q)) {
      results.push(v);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export function smartSearch(
  query: string,
  limit = 20,
  translation = "KJV",
): BibleVerse[] {
  const asReference = lookupReference(query, translation);
  if (asReference.length > 0) return asReference;
  return searchText(query, limit, translation);
}

export function listTranslations(): TranslationInfo[] {
  const list: TranslationInfo[] = [{ id: "KJV", name: "KJV" }];
  const dir = translationsPath();
  if (!fs.existsSync(dir)) return list;
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith(".json")) {
      const id = file.slice(0, -5);
      if (id !== "KJV") {
        list.push({ id, name: id });
      }
    }
  }
  return list;
}

export function importTranslation(
  id: string,
  verses: BibleVerse[],
  verse_counts?: Record<string, number[]>,
): void {
  const dir = translationsPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const payload = verse_counts ? { verse_counts, data: verses } : verses;
  fs.writeFileSync(
    path.join(dir, `${id}.json`),
    JSON.stringify(payload, null, 2),
    "utf-8",
  );
  cache.delete(id);
}

export function deleteTranslation(id: string): void {
  if (id === "KJV") return;
  const filePath = path.join(translationsPath(), `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  cache.delete(id);
}
