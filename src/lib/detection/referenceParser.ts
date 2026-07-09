// Detects explicit references like "John 3:16" or "turn to Philippians
// chapter four verse thirteen" inside a rolling transcript window.
// This is a skeleton - fill in BOOK_ALIASES and the number-word map next.

export interface ParsedReference {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  matchedText: string
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
  // extend through common chapter/verse ranges
}

// Maps common mis-transcriptions and spoken variants to canonical book names.
// e.g. STT often hears "Philippians" as "Philippines" - correct those here.
const BOOK_ALIASES: Record<string, string> = {
  philippines: 'Philippians',
  revelations: 'Revelation'
  // extend with full 66-book alias table
}

export function parseExplicitReferences(transcript: string): ParsedReference[] {
  // TODO: normalize spoken numbers, fuzzy-match book names via BOOK_ALIASES,
  // then run a regex like /(\w+)\s+(\d+)[:\s](\d+)(?:-(\d+))?/ against the
  // normalized text.
  return []
}
