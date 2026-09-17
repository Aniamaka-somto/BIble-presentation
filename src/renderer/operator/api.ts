import type { ScriptureCasterApi } from '../../shared/types'

export const api: ScriptureCasterApi = window.scriptureCaster

export function bgUrl(fileName: string): string {
  return 'bg://' + fileName
}