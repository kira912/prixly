import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { AiError, type ExtractRequest, type LlmProvider } from './types'

export const DEFAULT_CLAUDE_MODEL = 'claude-opus-5-5'

export interface ClaudeOptions {
  apiKey?: string
  model?: string
  workspaceId?: string
}

export function createClaudeProvider({ apiKey, model, workspaceId }: ClaudeOptions): LlmProvider {
  const anthropic = apiKey
    ? new Anthropic({
        apiKey,
        timeout: 60_000,
        maxRetries: 1,
        defaultHeaders: workspaceId ? { 'anthropic-workspace-id': workspaceId } : undefined,
      })
    : null
  const resolvedModel = model || DEFAULT_CLAUDE_MODEL
  const label = `anthropic:${resolvedModel}`

  return {
    label,
    enabled: anthropic !== null,
    async extract<T>({ system, user, schema, effort = 'low', maxTokens = 16000 }: ExtractRequest<T>): Promise<T> {
      if (!anthropic) throw new AiError(503, 'errors.ai.unavailable', 'Anthropic API key missing')

      const isHaiku = resolvedModel.startsWith('claude-haiku')
      let response
      try {
        response = await anthropic.beta.messages.parse({
          model: resolvedModel,
          max_tokens: maxTokens,
          ...(isHaiku ? {} : { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }),
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: user }],
          output_config: {
            format: betaZodOutputFormat(schema),
            ...(isHaiku ? {} : { effort }),
          },
        })
      }
      catch (error) {
        throw toAiError(label, error)
      }

      if (response.stop_reason === 'refusal') throw new AiError(422, 'errors.ai.refused')
      if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
        console.warn(`[ai] ${label}: unusable response (stop_reason=${response.stop_reason})`)
        throw new AiError(502, 'errors.ai.failed')
      }
      return response.parsed_output as T
    },
  }
}

function toAiError(label: string, error: unknown): AiError {
  if (error instanceof Anthropic.RateLimitError) return new AiError(429, 'errors.ai.busy')
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    console.error(`[ai] ${label}: invalid key or no access to the model`)
    return new AiError(503, 'errors.ai.unavailable')
  }
  if (error instanceof Anthropic.BadRequestError) {
    console.error(`[ai] ${label}: invalid request: ${error.message}`)
    return new AiError(502, 'errors.ai.failed')
  }
  if (error instanceof Anthropic.APIConnectionError) return new AiError(503, 'errors.ai.unavailable')
  if (error instanceof Anthropic.APIError) {
    console.warn(`[ai] ${label}: error ${error.status}: ${error.message}`)
    return new AiError(502, 'errors.ai.failed')
  }
  console.error(`[ai] ${label}: unexpected error: ${String(error)}`)
  return new AiError(502, 'errors.ai.failed')
}
