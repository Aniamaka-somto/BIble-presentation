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
  const ids = translations.map((t) => t.id)
  const matches = await api
    .paraphraseSearchAll(text, ids, preferredTranslation)
    .then((res) =>
      res.map((r) => {
        const t = translations.find((t2) => t2.id === (r as { translation?: string }).translation)
        return {
          ...r,
          translation: t?.id ?? preferredTranslation,
          translationName: t?.name ?? preferredTranslation,
        }
      }),
    )
    .catch(() => [])
  const best = new Map<string, ParaphraseCandidate>()
  for (const m of matches) {
    const key = `${m.book}|${m.chapter}|${m.verse}`
    const existing = best.get(key)
    if (
      !existing ||
      m.score > existing.score ||
      (m.score === existing.score && m.translation === preferredTranslation)
    ) {
      best.set(key, { ...m, translation: m.translation, translationName: m.translationName })
    }
  }
  const candidates = [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_PARAPHRASE_MATCHES)
  if (candidates.length === 0) return []
  const key = candidates
    .map((c) => `${c.translation}:${c.book} ${c.chapter}:${c.verse}`)
    .sort()
    .join('|')
  if (key === recentParaphraseKey) return []
  recentParaphraseKey = key
  recentParaphraseTime = Date.now()
  return candidates
}