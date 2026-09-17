// Detects explicit references like "John 3:16" or "turn to Philippians
// chapter four verse thirteen" inside a live transcript window.

import { BOOK_LOOKUP } from "./books";
import { normalizeNumbers } from "./numbers";

export interface ParsedReference {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  matchedText: string
}

const BOOK_CAPTURE =
  "((?:[123](?:st|nd|rd)?\\s+)?(?:first\\s+|second\\s+|third\\s+)?[a-z]+(?:\\s+of\\s+[a-z]+)?)";

const REF_PATTERN = new RegExp(
  "\\b" +
    BOOK_CAPTURE +
    "(?:\\s+chapter)?\\s+(\\d{1,3})(?:\\s*:\\s*|\\s+verse\\s+|\\s+)(\\d{1,3})\\b",
  "gi",
);

export function parseExplicitReferences(transcript: string): ParsedReference[] {
  const normalized = normalizeNumbers(transcript);
  const found: ParsedReference[] = [];
  let m: RegExpExecArray | null;
  REF_PATTERN.lastIndex = 0;
  while ((m = REF_PATTERN.exec(normalized)) !== null) {
    const rawBook = m[1].trim().toLowerCase();
    const canonical = BOOK_LOOKUP.get(rawBook);
    if (!canonical) continue;
    found.push({
      book: canonical,
      chapter: parseInt(m[2], 10),
      verse: parseInt(m[3], 10),
      matchedText: m[0],
    });
  }
  return found;
}