import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { applyCuration, CURATE_SYSTEM, CurationSchema, curationPrompt, type Curation } from '../lib/curate'
import type { EbayItem } from '../lib/ebay'

const MODEL = 'claude-opus-5-5'

/** Même durée que les résultats eBay qu'il trie */
const CURATE_TTL_SEC = 15 * 60

export class CurateError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'CurateError'
  }
}

let client: Anthropic | undefined

/** Client Anthropic, ou null si NUXT_ANTHROPIC_API_KEY n'est pas défini (le tri par l'IA est alors masqué) */
export function anthropicClient(): Anthropic | null {
  const apiKey = useRuntimeConfig().anthropicApiKey
  if (!apiKey) return null
  client ??= new Anthropic({ apiKey, timeout: 90_000, maxRetries: 1 })
  return client
}

export async function cachedCuration(anthropic: Anthropic, cacheKey: string, query: string, items: EbayItem[]): Promise<Curation> {
  const key = `curate:${cacheKey}`
  const cached = await kvGet<Curation>(key)
  if (cached) return cached
  const curation = await curate(anthropic, query, items)
  await kvSet(key, curation, { ttlSec: CURATE_TTL_SEC })
  return curation
}

async function curate(anthropic: Anthropic, query: string, items: EbayItem[]): Promise<Curation> {
  let message
  try {
    message = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: CURATE_SYSTEM,
      messages: [{ role: 'user', content: curationPrompt(query, items) }],
      // Classement simple : effort bas, plus rapide et moins cher
      output_config: { effort: 'low', format: betaZodOutputFormat(CurationSchema) },
      // Si les filtres de sécurité refusent la requête, Anthropic la relance sur le modèle de repli recommandé
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
  }
  catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      console.error('[curate] clé Anthropic refusée :', err.message)
      throw new CurateError(502, 'Le tri par l\'IA est indisponible.')
    }
    if (err instanceof Anthropic.RateLimitError) throw new CurateError(429, 'Le tri par l\'IA est très demandé. Réessaie dans une minute.')
    if (err instanceof Anthropic.APIError) {
      console.error('[curate]', err.status, err.message)
      throw new CurateError(502, 'Le tri par l\'IA a échoué. Réessaie plus tard.')
    }
    throw err
  }

  if (message.stop_reason === 'refusal') throw new CurateError(422, 'L\'IA n\'a pas pu trier ces annonces.')
  if (!message.parsed_output) {
    console.error('[curate] réponse illisible, stop_reason =', message.stop_reason)
    throw new CurateError(502, 'Le tri par l\'IA a échoué. Réessaie plus tard.')
  }
  return applyCuration(items, message.parsed_output)
}
