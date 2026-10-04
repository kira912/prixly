import { createLlm, type LlmProvider } from '../lib/llm'

let llm: LlmProvider | undefined

const pick = (...values: (string | undefined)[]) => values.map(v => v?.trim()).find(Boolean)

export function useLlm(): LlmProvider {
  if (llm) return llm
  const config = useRuntimeConfig()
  llm = createLlm({
    provider: pick(config.llmProvider, process.env.LLM_PROVIDER),
    claude: {
      apiKey: pick(config.anthropicApiKey, process.env.ANTHROPIC_API_KEY),
      model: pick(config.anthropicModel, process.env.ANTHROPIC_MODEL),
      workspaceId: pick(config.anthropicWorkspaceId),
    },
    compatible: {
      apiKey: pick(config.llmApiKey, process.env.LLM_API_KEY),
      baseUrl: pick(config.llmBaseUrl, process.env.LLM_BASE_URL),
      model: pick(config.llmModel, process.env.LLM_MODEL),
      webSearchModel: pick(config.llmWebSearchModel, process.env.LLM_WEB_SEARCH_MODEL),
    },
  })
  console.info(`[ai] ${llm.label}${llm.enabled ? '' : ' (disabled: missing key)'}`)
  return llm
}
