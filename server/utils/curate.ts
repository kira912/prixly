import { applyCuration, curateSystem, CurationSchema, curationPrompt, type Curation } from '../lib/curate'
import type { EbayItem } from '../lib/ebay'
import { languageName, type Locale } from '../lib/i18n'
import type { LlmProvider } from '../lib/llm'

const CURATE_TTL_SEC = 15 * 60

export async function cachedCuration(llm: LlmProvider, cacheKey: string, query: string, items: EbayItem[], locale: Locale): Promise<Curation> {
  const key = `curate:${llm.label}:${cacheKey}`
  const cached = await kvGet<Curation>(key)
  if (cached) return cached
  const output = await llm.extract({
    system: curateSystem(languageName(locale)),
    user: curationPrompt(query, items),
    schema: CurationSchema,
    effort: 'low',
  })
  const curation = applyCuration(items, output)
  await kvSet(key, curation, { ttlSec: CURATE_TTL_SEC })
  return curation
}
