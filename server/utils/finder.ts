import { assistPrompt, type AssistAdvice } from '../lib/assist'
import {
  applyRanking,
  dedupeCandidates,
  fromEbay,
  fromWebHit,
  parseWebHits,
  rankPrompt,
  RankSchema,
  rankSystem,
  WEB_SEARCH_SYSTEM,
  webSearchPrompt,
  withVerifiedProduct,
  type Candidate,
  type FinderResult,
  type SourceStatus,
} from '../lib/finder'
import { languageName, type Locale } from '../lib/i18n'
import { identify } from '../lib/links'
import { AiError, type LlmProvider } from '../lib/llm'
import { ExtractError } from '../lib/types'

const FINDER_TTL_SEC = 30 * 60
const EBAY_PER_QUERY = 8
const MAX_VERIFIED = 4

export async function cachedFinder(llm: LlmProvider, need: string, answers: string[], locale: Locale): Promise<FinderResult & { advice: AssistAdvice }> {
  const advice = await cachedAdvice(llm, need, answers, locale)
  const key = `finder:${llm.label}:${locale}:${assistPrompt(need, answers).toLowerCase()}`
  const cached = await kvGet<FinderResult>(key)
  if (cached) return { ...cached, advice }

  const [ebay, web] = await Promise.all([
    settle(() => ebayCandidates(advice, locale)),
    settle(() => webCandidates(llm, need, advice)),
  ])
  const sources: FinderResult['sources'] = { ebay: ebay.status, web: web.status }
  const candidates = dedupeCandidates([...web.candidates, ...ebay.candidates])

  let result: FinderResult = { picks: [], others: candidates, sources }
  if (candidates.length) {
    try {
      const output = await llm.extract({
        system: rankSystem(languageName(locale)),
        user: rankPrompt(need, advice, candidates),
        schema: RankSchema,
        effort: 'low',
      })
      result = { ...applyRanking(candidates, output), sources }
    }
    catch (err) {
      console.warn(`[finder] ranking failed, returning unranked offers: ${(err as Error).message}`)
    }
  }

  const complete = (status: SourceStatus) => status === 'ok' || status === 'off'
  if (complete(sources.ebay) && complete(sources.web)) await kvSet(key, result, { ttlSec: FINDER_TTL_SEC })
  return { ...result, advice }
}

async function settle(run: () => Promise<Candidate[] | null>): Promise<{ status: SourceStatus, candidates: Candidate[] }> {
  try {
    const candidates = await run()
    return candidates === null ? { status: 'off', candidates: [] } : { status: 'ok', candidates }
  }
  catch (err) {
    console.warn(`[finder] source failed: ${(err as Error).message}`)
    return { status: err instanceof AiError && err.key === 'errors.ai.quota' ? 'quota' : 'error', candidates: [] }
  }
}

async function ebayCandidates(advice: AssistAdvice, locale: Locale): Promise<Candidate[] | null> {
  const credentials = ebayCredentials()
  if (!credentials) return null
  const condition = advice.condition === 'any' ? undefined : advice.condition
  const results = await Promise.allSettled(advice.queries.map(q => cachedEbaySearch(credentials, q.query, { condition, locale })))
  const fulfilled = results.filter(r => r.status === 'fulfilled')
  if (!fulfilled.length && results.length) throw (results[0] as PromiseRejectedResult).reason
  return fulfilled.flatMap(r => r.value.items.slice(0, EBAY_PER_QUERY)).map(fromEbay)
}

async function webCandidates(llm: LlmProvider, need: string, advice: AssistAdvice): Promise<Candidate[] | null> {
  if (!llm.searchWeb) return null
  const text = await llm.searchWeb({ system: WEB_SEARCH_SYSTEM, user: webSearchPrompt(need, advice) })
  const hits = parseWebHits(text)

  let verified = 0
  const candidates = await Promise.all(hits.map(async (hit): Promise<Candidate | null> => {
    const candidate = fromWebHit(hit)
    if (!identify(hit.url) || verified >= MAX_VERIFIED) return candidate
    verified++
    try {
      const { product } = await lookupProduct(hit.url)
      return withVerifiedProduct(candidate, product)
    }
    catch (err) {
      if (err instanceof ExtractError && (err.code === 'not_found' || err.code === 'unsupported')) return null
      return candidate
    }
  }))
  const kept = candidates.filter((c): c is Candidate => c !== null)
  console.info(`[finder] web search: ${hits.length} product links, ${verified} checked by Prixly, ${kept.length} kept`)
  if (!hits.length) console.info(`[finder] web search answer: ${text.slice(0, 500).replace(/\s+/g, ' ')}`)
  return kept
}
