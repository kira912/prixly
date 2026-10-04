import { z } from 'zod'
import { AiError, type ExtractRequest, type LlmProvider, type WebSearchRequest } from './types'

export const DEFAULT_LLM_BASE_URL = 'https://api.groq.com/openai/v1'
export const DEFAULT_LLM_MODEL = 'openai/gpt-oss-120b'
export const DEFAULT_WEB_SEARCH_MODEL = 'openai/gpt-oss-20b'

export interface OpenAiCompatibleOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
  webSearchModel?: string
  fetchImpl?: typeof fetch
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null }, finish_reason?: string }[]
}

class SchemaRejected extends Error {}

export function createOpenAiCompatibleProvider({ apiKey, baseUrl, model, webSearchModel, fetchImpl = fetch }: OpenAiCompatibleOptions): LlmProvider {
  const resolvedBaseUrl = (baseUrl || DEFAULT_LLM_BASE_URL).replace(/\/$/, '')
  const resolvedModel = model || DEFAULT_LLM_MODEL
  const label = `openai-compatible:${resolvedModel}`
  const resolvedWebSearchModel = webSearchModel || DEFAULT_WEB_SEARCH_MODEL
  let schemaUnsupported = false

  const extractModels = isGroq(resolvedBaseUrl) ? [...new Set([resolvedModel, resolvedWebSearchModel])] : [resolvedModel]

  async function complete(system: string, user: string, jsonSchema: Record<string, unknown>, maxTokens: number, effort: 'low' | 'medium', mode: 'json_schema' | 'json_object'): Promise<string> {
    let lastError: AiError | undefined
    for (const candidateModel of extractModels) {
      try {
        return await completeWith(candidateModel, system, user, jsonSchema, maxTokens, effort, mode)
      }
      catch (error) {
        if (!(error instanceof AiError) || error.statusCode !== 429) throw error
        lastError = error
        if (candidateModel !== extractModels.at(-1)) console.warn(`[ai] ${candidateModel}: rate limited, trying the next model`)
      }
    }
    throw lastError!
  }

  async function completeWith(chatModel: string, system: string, user: string, jsonSchema: Record<string, unknown>, maxTokens: number, effort: 'low' | 'medium', mode: 'json_schema' | 'json_object'): Promise<string> {
    const body = {
      model: chatModel,
      max_tokens: maxTokens,
      temperature: 0.2,
      ...(chatModel.includes('gpt-oss') ? { reasoning_effort: effort } : {}),
      response_format: mode === 'json_schema'
        ? { type: 'json_schema', json_schema: { name: 'answer', strict: true, schema: jsonSchema } }
        : { type: 'json_object' },
      messages: [
        { role: 'system', content: `${system}\n\nAnswer with a single JSON object matching this JSON Schema:\n${JSON.stringify(jsonSchema)}` },
        { role: 'user', content: user },
      ],
    }

    let response!: Response
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetchImpl(`${resolvedBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        })
      }
      catch {
        throw new AiError(503, 'errors.ai.unavailable', 'AI endpoint unreachable')
      }
      const waitMs = retryDelayMs(response)
      if (waitMs == null || waitMs > SHORT_RETRY_MS || attempt === 1) break
      console.warn(`[ai] ${chatModel}: rate limited, retrying in ${waitMs} ms`)
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      if (response.status === 400 && mode === 'json_schema' && /schema|response_format/i.test(detail)) throw new SchemaRejected()
      throw toAiError(`openai-compatible:${chatModel}`, response.status, detail)
    }
    const completion = await response.json() as ChatCompletion
    const choice = completion.choices?.[0]
    if (!choice?.message?.content || choice.finish_reason === 'length') throw new AiError(502, 'errors.ai.failed', 'Empty or truncated answer')
    return choice.message.content
  }

  async function searchWebWith(webModel: string, system: string, user: string, maxTokens: number): Promise<{ response: Response, detail: string }> {
    const body = JSON.stringify({
      model: webModel,
      max_completion_tokens: maxTokens,
      temperature: 1,
      top_p: 1,
      reasoning_effort: 'low',
      tool_choice: 'required',
      tools: [{ type: 'browser_search' }],
      messages: [{ role: 'user', content: `${system} ${user}` }],
    })
    let response!: Response
    let detail = ''
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await fetchImpl(`${resolvedBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body,
          signal: AbortSignal.timeout(90_000),
        })
      }
      catch {
        throw new AiError(503, 'errors.ai.unavailable', 'AI endpoint unreachable')
      }
      if (response.ok) return { response, detail }
      detail = await response.text().catch(() => '')
      const waitMs = isDailyQuota(detail) ? null : retryDelayMs(response)
      if ((response.status < 500 && waitMs == null) || attempt === 1) break
      console.warn(`[ai] ${webModel} (web search): error ${response.status}, retrying: ${detail.slice(0, 200)}`)
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs))
    }
    return { response, detail }
  }

  async function searchWeb({ system, user, maxTokens = 2048 }: WebSearchRequest): Promise<string> {
    if (!apiKey) throw new AiError(503, 'errors.ai.unavailable', 'LLM_API_KEY missing')
    const models = [...new Set([resolvedWebSearchModel, resolvedModel])].filter(m => supportsBrowserSearch(resolvedBaseUrl, m))

    let lastError: AiError | undefined
    for (const webModel of models) {
      const { response, detail } = await searchWebWith(webModel, system, user, maxTokens)
      if (response.ok) {
        const completion = await response.json() as ChatCompletion
        const content = completion.choices?.[0]?.message?.content
        if (content) return content
        lastError = new AiError(502, 'errors.ai.failed', 'Empty web search answer')
        continue
      }
      lastError = toAiError(`${webModel} (web search)`, response.status, detail)
      if (response.status !== 429 && response.status < 500) throw lastError
      console.warn(`[ai] ${webModel} (web search) unavailable, trying the next model`)
    }
    throw lastError ?? new AiError(502, 'errors.ai.failed')
  }

  return {
    label,
    enabled: Boolean(apiKey),
    ...(supportsBrowserSearch(resolvedBaseUrl, resolvedWebSearchModel) ? { searchWeb } : {}),
    async extract<T>({ system, user, schema, effort = 'low', maxTokens = 8192 }: ExtractRequest<T>): Promise<T> {
      if (!apiKey) throw new AiError(503, 'errors.ai.unavailable', 'LLM_API_KEY missing')
      const jsonSchema = toStrictJsonSchema(schema)

      let content: string
      if (schemaUnsupported) {
        content = await complete(system, user, jsonSchema, maxTokens, effort, 'json_object')
      }
      else {
        try {
          content = await complete(system, user, jsonSchema, maxTokens, effort, 'json_schema')
        }
        catch (error) {
          if (!(error instanceof SchemaRejected)) throw error
          console.warn(`[ai] ${label}: json_schema rejected, falling back to plain JSON mode`)
          schemaUnsupported = true
          content = await complete(system, user, jsonSchema, maxTokens, effort, 'json_object')
        }
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(content)
      }
      catch {
        throw new AiError(502, 'errors.ai.failed', 'Invalid JSON')
      }
      const result = schema.safeParse(parsed)
      if (!result.success) {
        console.warn(`[ai] ${label}: answer does not match the schema: ${result.error.message}`)
        throw new AiError(502, 'errors.ai.failed', 'Answer does not match the schema')
      }
      return result.data
    },
  }
}

function toAiError(label: string, status: number, detail: string): AiError {
  if (status === 429) {
    console.warn(`[ai] ${label}: rate limited: ${detail.slice(0, 300)}`)
    return new AiError(429, isDailyQuota(detail) ? 'errors.ai.quota' : 'errors.ai.busy')
  }
  if (status === 401 || status === 403) {
    console.error(`[ai] ${label}: invalid key or no access to the model`)
    return new AiError(503, 'errors.ai.unavailable')
  }
  console.warn(`[ai] ${label}: error ${status}: ${detail.slice(0, 300)}`)
  return new AiError(502, 'errors.ai.failed')
}

export function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip)
    if (node && typeof node === 'object') {
      const entries = Object.entries(node)
        .filter(([key]) => !['$schema', 'minimum', 'maximum'].includes(key))
        .map(([key, value]) => [key, strip(value)] as const)
      const out = Object.fromEntries(entries) as Record<string, unknown>
      if (out.type === 'object' && out.properties) out.additionalProperties = false
      return out
    }
    return node
  }
  return strip(z.toJSONSchema(schema)) as Record<string, unknown>
}

function isGroq(baseUrl: string): boolean {
  return /(^|\.)groq\.com$/.test(new URL(baseUrl).hostname)
}

export function supportsBrowserSearch(baseUrl: string, model: string): boolean {
  return isGroq(baseUrl) && model.startsWith('openai/gpt-oss')
}

export const MAX_RETRY_WAIT_MS = 15_000
const SHORT_RETRY_MS = 3_000

export function retryDelayMs(response: Response): number | null {
  if (response.status !== 429) return null
  const seconds = Number(response.headers.get('retry-after'))
  if (!Number.isFinite(seconds) || seconds <= 0) return 2000
  const ms = Math.ceil(seconds * 1000)
  return ms <= MAX_RETRY_WAIT_MS ? ms : null
}

export function isDailyQuota(detail: string): boolean {
  return /per day|\((TPD|RPD)\)/i.test(detail)
}
