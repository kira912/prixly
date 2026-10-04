import { MAX_NEED_LENGTH } from '../../lib/assist'
import { AiError } from '../../lib/llm'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ need?: unknown, answers?: unknown }>(event)
  const need = typeof body?.need === 'string' ? body.need.trim() : ''
  if (!need || need.length > MAX_NEED_LENGTH) throw localizedError(event, 400, 'errors.needTooLong', { max: MAX_NEED_LENGTH })
  const answers = Array.isArray(body?.answers) ? body.answers.filter((a): a is string => typeof a === 'string').slice(0, 3) : []
  if (answers.some(a => a.length > 300)) throw localizedError(event, 400, 'errors.answerTooLong')

  const llm = useLlm()
  if (!llm.enabled) throw localizedError(event, 404, 'errors.assistantDisabled')

  await enforceRateLimit(event, 'assist')
  try {
    return await cachedAdvice(llm, need, answers, eventLocale(event))
  }
  catch (err) {
    if (err instanceof AiError) throw localizedError(event, err.statusCode, err.key)
    throw err
  }
})
