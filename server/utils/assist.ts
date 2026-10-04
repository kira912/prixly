import { assistSystem, AssistSchema, assistPrompt, cleanAdvice, type AssistAdvice } from '../lib/assist'
import { languageName, type Locale } from '../lib/i18n'
import type { LlmProvider } from '../lib/llm'

const ASSIST_TTL_SEC = 24 * 3600

export async function cachedAdvice(llm: LlmProvider, need: string, answers: string[], locale: Locale): Promise<AssistAdvice> {
  const user = assistPrompt(need, answers)
  const key = `assist:${llm.label}:${locale}:${user.toLowerCase()}`
  const cached = await kvGet<AssistAdvice>(key)
  if (cached) return cached
  const advice = cleanAdvice(await llm.extract({
    system: assistSystem(languageName(locale)),
    user,
    schema: AssistSchema,
    effort: 'medium',
  }))
  await kvSet(key, advice, { ttlSec: ASSIST_TTL_SEC })
  return advice
}
