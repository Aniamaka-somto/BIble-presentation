import { api } from '../api'

export interface ParaphraseCandidate {
  book: string
  chapter: number
  verse: number
  endVerse?: number
  score: number
  translation: string
  translationName: string
}

let recentParaphraseKey: string | null = null
let recentParaphraseTime = 0

const PARAPHRASE_COOLDOWN_MS = 30000
const MAX_PARAPHRASE_MATCHES = 4

export async function paraphraseScout(
  text: string,
  preferredTranslation: string,
): Promise<ParaphraseCandidate[]> {
  if (recentParaphraseKey && Date.now() - recentParaphraseTime < PARAPHRASE_COOLDOWN_MS) {
    return []
  }
  const translations = await api.listTranslations()
  const all = await Promise.all(
    translations.map((t) =>
      api
        .paraphraseSearch(text, t.id)
        .then((res) =>
          res.map((r) => ({
            ...r,
            translation: t.id,
            translationName: t.name,
          })),
        )
        .catch(() => []),
    ),
  )
  let candidates = all.flat().filter(Boolean) as ParaphraseCandidate[]
  if (candidates.length === 0) return []
  const best = new Map<string, ParaphraseCandidate>()
  for (const c of candidates) {
    const key = `${c.book}|${c.chapter}|${c.verse}`
    const existing = best.get(key)
    if (
      !existing ||
      c.score > existing.score ||
      (c.score === existing.score && c.translation === preferredTranslation)
    ) {
      best.set(key, c)
    }
  }
  candidates = [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PARAPHRASE_MATCHES)
  const key = candidates
    .map((c) => `${c.translation}:${c.book} ${c.chapter}:${c.verse}`)
    .sort()
    .join('|')
  if (key === recentParaphraseKey) return []
  recentParaphraseKey = key
  recentParaphraseTime = Date.now()
  return candidates
}