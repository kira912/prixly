import type { H3Event } from 'h3'
import { DEFAULT_LOCALE, LOCALE_COOKIE, localeFromAcceptLanguage, toLocale, translator, type Locale, type Translate } from '../lib/i18n'

export function eventLocale(event: H3Event): Locale {
  return toLocale(getCookie(event, LOCALE_COOKIE))
    ?? localeFromAcceptLanguage(getHeader(event, 'accept-language'))
    ?? DEFAULT_LOCALE
}

export function useServerT(event: H3Event): Translate {
  return translator(eventLocale(event))
}

export function localizedError(event: H3Event, statusCode: number, key: string, params?: Record<string, string | number>) {
  return createError({ statusCode, message: useServerT(event)(key, params), data: { code: key } })
}
