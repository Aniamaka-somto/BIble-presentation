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

function tokenize(text: string): string[] {
  return text.toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// Word-overlap scoring for paraphrase detection.
// Returns verses where a significant fraction of the query's content words appear.
export function paraphraseSearch(
  query: string,
  limit = 5,
  threshold = 0.35,
): ParaphraseMatch[] {
  const queryWords = tokenize(query);
  if (queryWords.length < 3) return [];

  const results: ParaphraseMatch[] = [];
  for (const v of ALL_VERSES) {
    const verseWords = new Set(tokenize(v.text));
    let matches = 0;
    for (const w of queryWords) {
      if (verseWords.has(w)) matches++;
    }
    const rawScore = matches / queryWords.length;
    // Boost: require at least 2 matching words for scores near threshold
    const adjusted = rawScore * Math.min(1, matches / 2);
    if (adjusted >= threshold) {
      results.push({ ...v, score: Math.round(adjusted * 100) / 100 });
    }
  }

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
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

// Tries reference format first ("Mark 1:2"), falls back to phrase/text search.
export function smartSearch(query: string, limit = 20): BibleVerse[] {
  const asReference = lookupReference(query);
  if (asReference.length > 0) return asReference;
  return searchText(query, limit);
}
