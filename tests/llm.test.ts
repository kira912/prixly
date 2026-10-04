import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { selectLlmProvider, type LlmProvider } from '../server/lib/llm'
import { createOpenAiCompatibleProvider, DEFAULT_LLM_MODEL, toStrictJsonSchema } from '../server/lib/llm/openai-compatible'

const schema = z.object({ kind: z.enum(['product', 'accessory']).nullable(), ids: z.array(z.number().int()) })

const reply = (status: number, body: unknown) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
const completion = (content: string) => reply(200, { choices: [{ message: { content }, finish_reason: 'stop' }] })

describe('openai-compatible provider', () => {
  const fetchMock = vi.fn<typeof fetch>()
  const provider = (apiKey: string | undefined = 'gsk_test') => createOpenAiCompatibleProvider({ apiKey, fetchImpl: fetchMock })
  const bodyOf = (call: number) => JSON.parse(fetchMock.mock.calls[call]![1]!.body as string)

  afterEach(() => {
    fetchMock.mockReset()
  })

  it('asks Groq for a strict JSON schema and validates the answer', async () => {
    fetchMock.mockImplementation(async () => completion('{"kind":"product","ids":[3]}'))

    const result = await provider().extract({ system: 'sys', user: 'usr', schema })

    expect(result).toEqual({ kind: 'product', ids: [3] })
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions')
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer gsk_test')
    const body = bodyOf(0)
    expect(body.model).toBe(DEFAULT_LLM_MODEL)
    expect(body.reasoning_effort).toBe('low')
    expect(body.response_format).toMatchObject({ type: 'json_schema', json_schema: { strict: true } })
    expect(body.messages[1]).toEqual({ role: 'user', content: 'usr' })
  })

  it('passes the requested reasoning effort', async () => {
    fetchMock.mockImplementation(async () => completion('{"kind":null,"ids":[]}'))
    await provider().extract({ system: 's', user: 'u', schema, effort: 'medium' })
    expect(bodyOf(0).reasoning_effort).toBe('medium')
  })

  it('falls back to JSON mode when the model rejects json_schema, and remembers it', async () => {
    fetchMock
      .mockResolvedValueOnce(reply(400, { error: { message: 'response_format json_schema is not supported' } }))
      .mockImplementation(async () => completion('{"kind":null,"ids":[]}'))
    const llm = provider()

    await llm.extract({ system: 's', user: 'u', schema })
    await llm.extract({ system: 's', user: 'u', schema })

    expect(bodyOf(1).response_format).toEqual({ type: 'json_object' })
    expect(bodyOf(2).response_format).toEqual({ type: 'json_object' })
  })

  it('rejects answers that don\'t match the schema', async () => {
    fetchMock.mockImplementation(async () => completion('{"kind":"book","ids":[]}'))
    await expect(provider().extract({ system: 's', user: 'u', schema })).rejects.toMatchObject({ statusCode: 502, key: 'errors.ai.failed' })
  })

  it('maps free-tier rate limits to 429 and a missing key to 503', async () => {
    fetchMock.mockImplementation(async () => reply(429, 'rate limit reached'))
    await expect(provider().extract({ system: 's', user: 'u', schema })).rejects.toMatchObject({ statusCode: 429, key: 'errors.ai.busy' })

    const noKey = createOpenAiCompatibleProvider({ fetchImpl: fetchMock })
    expect(noKey.enabled).toBe(false)
    await expect(noKey.extract({ system: 's', user: 'u', schema })).rejects.toMatchObject({ statusCode: 503 })
  })

  it('produces a schema accepted by strict mode', () => {
    const json = toStrictJsonSchema(schema)
    expect(json.$schema).toBeUndefined()
    expect(JSON.stringify(json)).not.toContain('maximum')
    expect(json).toMatchObject({ additionalProperties: false, required: ['kind', 'ids'] })
  })
})

describe('selectLlmProvider', () => {
  const claude = (enabled: boolean) => ({ enabled, label: 'anthropic' }) as LlmProvider
  const compatible = { enabled: true, label: 'compatible' } as LlmProvider

  it('prefers Claude when its key is set, otherwise the free OpenAI-compatible endpoint', () => {
    const withKey = claude(true)
    expect(selectLlmProvider({}, withKey, compatible)).toBe(withKey)
    expect(selectLlmProvider({}, claude(false), compatible)).toBe(compatible)
  })

  it('honours an explicit provider', () => {
    expect(selectLlmProvider({ provider: 'openai-compatible' }, claude(true), compatible)).toBe(compatible)
    expect(selectLlmProvider({ provider: 'anthropic' }, claude(false), compatible)).not.toBe(compatible)
  })
})

describe('openai-compatible provider on rate limits', () => {
  const schema = z.object({ ok: z.boolean() })

  it('switches to the other Groq model instead of waiting long', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"error":{"message":"tokens per minute (TPM)"}}', { status: 429, headers: { 'retry-after': '7' } }))
      .mockImplementation(async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] })))
    const result = await createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl }).extract({ system: 's', user: 'u', schema })
    expect(result).toEqual({ ok: true })
    expect(fetchImpl.mock.calls.map(c => JSON.parse(c[1]!.body as string).model)).toEqual(['openai/gpt-oss-120b', 'openai/gpt-oss-20b'])
  })

  it('stays on the configured model for non-Groq endpoints', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('{}', { status: 429, headers: { 'retry-after': '60' } }))
    await expect(createOpenAiCompatibleProvider({ apiKey: 'k', baseUrl: 'https://openrouter.ai/api/v1', model: 'x/y', fetchImpl }).extract({ system: 's', user: 'u', schema })).rejects.toMatchObject({ statusCode: 429 })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})
