import type { z } from 'zod'

export interface ExtractRequest<T> {
  system: string
  user: string
  schema: z.ZodType<T>
  effort?: 'low' | 'medium'
  maxTokens?: number
}

export interface WebSearchRequest {
  system: string
  user: string
  maxTokens?: number
}

export interface LlmProvider {
  readonly label: string
  readonly enabled: boolean
  extract: <T>(request: ExtractRequest<T>) => Promise<T>
  searchWeb?: (request: WebSearchRequest) => Promise<string>
}

export class AiError extends Error {
  constructor(public statusCode: number, public key: string, detail?: string) {
    super(detail ?? key)
    this.name = 'AiError'
  }
}
