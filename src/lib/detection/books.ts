// Canonical book names plus a merged alias table covering both the
// library search autocomplete (typed abbreviations) and live detection
// (spoken/STT-misheard variants like "1st samuel" or "philippians").

export const BOOK_NAMES: string[] = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
];

// Typed-abbreviation aliases used by the search autocomplete.
const SEARCH_ALIASES: Record<string, string> = {
  ps: "Psalms",
  psalm: "Psalms",
  gen: "Genesis",
  ex: "Exodus",
  matt: "Matthew",
  rom: "Romans",
  jn: "John",
  rev: "Revelation",
  heb: "Hebrews",
  cor: "Corinthians",
};

// Spoken / STT-misheard variants used by live reference detection.
const SPOKEN_ALIASES: Record<string, string> = {
  "1 samuel": "1 Samuel",
  "1st samuel": "1 Samuel",
  "first samuel": "1 Samuel",
  "2 samuel": "2 Samuel",
  "2nd samuel": "2 Samuel",
  "second samuel": "2 Samuel",
  "1 kings": "1 Kings",
  "1st kings": "1 Kings",
  "first kings": "1 Kings",
  "2 kings": "2 Kings",
  "2nd kings": "2 Kings",
  "second kings": "2 Kings",
  "1 chronicles": "1 Chronicles",
  "1st chronicles": "1 Chronicles",
  "first chronicles": "1 Chronicles",
  "2 chronicles": "2 Chronicles",
  "2nd chronicles": "2 Chronicles",
  "second chronicles": "2 Chronicles",
  "song of solomon": "Song of Solomon",
  psalm: "Psalms",
  psalms: "Psalms",
  "1 corinthians": "1 Corinthians",
  "1st corinthians": "1 Corinthians",
  "first corinthians": "1 Corinthians",
  "2 corinthians": "2 Corinthians",
  "2nd corinthians": "2 Corinthians",
  "second corinthians": "2 Corinthians",
  "1 thessalonians": "1 Thessalonians",
  "1st thessalonians": "1 Thessalonians",
  "first thessalonians": "1 Thessalonians",
  "2 thessalonians": "2 Thessalonians",
  "2nd thessalonians": "2 Thessalonians",
  "second thessalonians": "2 Thessalonians",
  "1 timothy": "1 Timothy",
  "1st timothy": "1 Timothy",
  "first timothy": "1 Timothy",
  "2 timothy": "2 Timothy",
  "2nd timothy": "2 Timothy",
  "second timothy": "2 Timothy",
  "1 peter": "1 Peter",
  "1st peter": "1 Peter",
  "first peter": "1 Peter",
  "2 peter": "2 Peter",
  "2nd peter": "2 Peter",
  "second peter": "2 Peter",
  "1 john": "1 John",
  "1st john": "1 John",
  "first john": "1 John",
  "2 john": "2 John",
  "2nd john": "2 John",
  "second john": "2 John",
  "3 john": "3 John",
  "3rd john": "3 John",
  "third john": "3 John",
  "i samuel": "1 Samuel",
  "ii samuel": "2 Samuel",
  "i kings": "1 Kings",
  "ii kings": "2 Kings",
  "i chronicles": "1 Chronicles",
  "ii chronicles": "2 Chronicles",
  "i corinthians": "1 Corinthians",
  "ii corinthians": "2 Corinthians",
  "i thessalonians": "1 Thessalonians",
  "ii thessalonians": "2 Thessalonians",
  "i timothy": "1 Timothy",
  "ii timothy": "2 Timothy",
  "i peter": "1 Peter",
  "ii peter": "2 Peter",
  "i john": "1 John",
  "ii john": "2 John",
  "iii john": "3 John",
  philippians: "Philippians",
  revelations: "Revelation",
  philippines: "Philippians",
};

export const BOOK_LOOKUP = new Map<string, string>();

for (const b of BOOK_NAMES) BOOK_LOOKUP.set(b.toLowerCase(), b);
for (const [k, v] of Object.entries(SEARCH_ALIASES)) BOOK_LOOKUP.set(k, v);
for (const [k, v] of Object.entries(SPOKEN_ALIASES)) BOOK_LOOKUP.set(k, v);

export interface BibleBookRef {
  name: string
  chapters: number
}

// Fuzzy matching used by the search autocomplete: prefix match on the
// canonical name, then typed abbreviations, then numeric-prefix stripping
// ("2 cor" → "2 Corinthians").
export function findBook(prefix: string, books: BibleBookRef[]): BibleBookRef | null {
  const lower = prefix.toLowerCase().replace(/\s+/g, "");
  if (!lower) return null;
  for (const b of books) {
    const key = b.name.toLowerCase().replace(/\s+/g, "");
    if (key.startsWith(lower)) return b;
  }
  const canonical = BOOK_LOOKUP.get(lower);
  if (canonical) {
    const hit = books.find((b) => b.name === canonical);
    if (hit) return hit;
  }
  const noNum = lower.replace(/^\d/, "");
  if (noNum !== lower) {
    for (const b of books) {
      const key = b.name
        .toLowerCase()
        .replace(/^\d+\s+/, "")
        .replace(/\s+/g, "");
      if (key.startsWith(noNum)) return b;
    }
  }
  return null;
}