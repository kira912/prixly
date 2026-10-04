import { createClaudeProvider, type ClaudeOptions } from './claude'
import { createOpenAiCompatibleProvider, type OpenAiCompatibleOptions } from './openai-compatible'
import type { LlmProvider } from './types'

export * from './types'

export interface LlmConfig {
  provider?: string
  claude: ClaudeOptions
  compatible: OpenAiCompatibleOptions
}

export function selectLlmProvider(
  { provider }: Pick<LlmConfig, 'provider'>,
  claude: LlmProvider,
  compatible: LlmProvider,
): LlmProvider {
  if (provider === 'anthropic') return claude
  if (provider === 'openai-compatible') return compatible
  return claude.enabled ? claude : compatible
}

export function createLlm(config: LlmConfig): LlmProvider {
  return selectLlmProvider(config, createClaudeProvider(config.claude), createOpenAiCompatibleProvider(config.compatible))
}
