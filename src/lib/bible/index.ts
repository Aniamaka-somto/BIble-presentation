import kjv from "./kjv.json";

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface ParaphraseMatch extends BibleVerse {
  score: number;
}

const ALL_VERSES = kjv as BibleVerse[];

// Index by "Book Chapter" for fast chapter lookups (what the filmstrip needs)
const chapterIndex = new Map<string, BibleVerse[]>();
for (const v of ALL_VERSES) {
  const key = `${v.book} ${v.chapter}`;
  if (!chapterIndex.has(key)) chapterIndex.set(key, []);
  chapterIndex.get(key)!.push(v);
}

export function getChapter(book: string, chapter: number): BibleVerse[] {
  return chapterIndex.get(`${book} ${chapter}`) ?? [];
}

export function getVerse(
  book: string,
  chapter: number,
  verse: number,
): BibleVerse | undefined {
  return getChapter(book, chapter).find((v) => v.verse === verse);
}

// Simple "Book chapter:verse" or "Book chapter:verse-verse" parser, e.g. "Luke 1:17"
export function lookupReference(ref: string): BibleVerse[] {
  const match = ref.trim().match(/^(.+?)\s+(\d+):(\d+)(?:-(\d+))?$/);
  if (!match) return [];
  const [, book, chapterStr, startStr, endStr] = match;
  const chapter = parseInt(chapterStr, 10);
  const start = parseInt(startStr, 10);
  const end = endStr ? parseInt(endStr, 10) : start;
  return getChapter(book.trim(), chapter).filter(
    (v) => v.verse >= start && v.verse <= end,
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

const STEM_SUFFIXES = [
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

// Word-overlap scoring for paraphrase detection, with order & proximity awareness.
// First tries an exact normalized-phrase match — if the transcript's words appear as a
// contiguous substring in a verse (ignoring punctuation), that's a guaranteed hit at 1.0.
// Falls through to token-level overlap + order/proximity scoring for looser matches.
export function paraphraseSearch(
  query: string,
  limit = 5,
  threshold = 0.4,
): ParaphraseMatch[] {
  // ---- Pre-pass: punctuation-agnostic exact phrase match ----
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const normQuery = norm(query);
  if (normQuery.length >= 3) {
    const exact: ParaphraseMatch[] = [];
    for (const v of ALL_VERSES) {
      if (norm(v.text).includes(normQuery)) {
        exact.push({ ...v, score: 1 });
        if (exact.length >= limit) break;
      }
    }
    if (exact.length > 0) return exact;
  }

  // ---- Word-overlap pass (for paraphrases, not exact quotes) ----
  const queryWords = tokenize(query);
  if (queryWords.length < 3) return [];

  const minMatches = Math.ceil(queryWords.length * 0.4);
  const maxSpan = queryWords.length * 5; // expected span if words are reasonably close

  const results: ParaphraseMatch[] = [];
  for (const v of ALL_VERSES) {
    const verseTokenized = tokenize(v.text);
    const verseWords = new Set(verseTokenized);
    let matches = 0;
    const matchPositions: number[] = [];
    for (const w of queryWords) {
      if (verseWords.has(w)) {
        matches++;
        // Record position of first occurrence in verse
        matchPositions.push(verseTokenized.indexOf(w));
      }
    }
    if (matches < minMatches) continue;

    const rawScore = matches / queryWords.length;

    // --- Order & proximity bonus ---
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

// Return canonical book order with chapter counts, derived from the corpus.
export interface BookInfo {
  name: string;
  chapters: number;
}

let _bookList: BookInfo[] | null = null;

export function getBookList(): BookInfo[] {
  if (_bookList) return _bookList;
  const seen = new Map<string, number>();
  for (const v of ALL_VERSES) {
    const cur = seen.get(v.book) ?? 0;
    if (v.chapter > cur) seen.set(v.book, v.chapter);
  }
  // Preserve corpus order (canonical)
  const ordered: BookInfo[] = [];
  const done = new Set<string>();
  for (const v of ALL_VERSES) {
    if (!done.has(v.book)) {
      ordered.push({ name: v.book, chapters: seen.get(v.book)! });
      done.add(v.book);
    }
  }
  _bookList = ordered;
  return ordered;
}

// Naive full-text search across the corpus — good enough for the manual
// search box until this gets replaced by a real pgvector/semantic search.
export function searchText(query: string, limit = 20): BibleVerse[] {
  const q = query.toLowerCase();
  const results: BibleVerse[] = [];
  for (const v of ALL_VERSES) {
    if (v.text.toLowerCase().includes(q)) {
      results.push(v);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// Punctuation-agnostic phrase search — strips punctuation from both the
// query and verse text so "shepherd, I shall" matches "shepherd; I shall".
export function phraseSearch(query: string, limit = 10): BibleVerse[] {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  const q = norm(query);
  if (q.length < 3) return [];
  const results: BibleVerse[] = [];
  for (const v of ALL_VERSES) {
    if (norm(v.text).includes(q)) {
      results.push(v);
      if (results.length >= limit) break;
    }
  }
  return results;
}

// Tries reference format first ("Mark 1:2"), falls back to phrase/text search.
export function smartSearch(query: string, limit = 20): BibleVerse[] {
  const asReference = lookupReference(query);
  if (asReference.length > 0) return asReference;
  return searchText(query, limit);
}
