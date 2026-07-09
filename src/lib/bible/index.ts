import kjv from "./kjv.json";

export interface BibleVerse {
  book: string;
  chapter: number;
  verse: number;
  text: string;
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
