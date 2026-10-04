import en from '../../i18n/locales/en.json'
import fr from '../../i18n/locales/fr.json'

export const LOCALES = ['fr', 'en'] as const
export type Locale = typeof LOCALES[number]
export const DEFAULT_LOCALE: Locale = 'fr'
export const LOCALE_COOKIE = 'prixly_locale'

const MESSAGES: Record<Locale, unknown> = { fr, en }

const INTL_LOCALES: Record<Locale, string> = { fr: 'fr-FR', en: 'en-GB' }

const LANGUAGE_NAMES: Record<Locale, string> = { fr: 'French', en: 'English' }

export type Translate = (key: string, params?: Record<string, string | number>) => string

export function toLocale(value: unknown): Locale | null {
  if (typeof value !== 'string') return null
  const base = value.trim().toLowerCase().split(/[-_]/)[0]
  return (LOCALES as readonly string[]).includes(base!) ? base as Locale : null
}

export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null
  const ranked = header.split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=')
      return { locale: toLocale(tag), q: q ? Number(q) : 1 }
    })
    .filter((r): r is { locale: Locale, q: number } => r.locale !== null)
    .sort((a, b) => b.q - a.q)
  return ranked[0]?.locale ?? null
}

export function intlLocale(locale: Locale): string {
  return INTL_LOCALES[locale]
}

export function languageName(locale: Locale): string {
  return LANGUAGE_NAMES[locale]
}

function lookup(messages: unknown, key: string): string | null {
  const value = key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages)
  return typeof value === 'string' ? value : null
}

export function translator(locale: Locale): Translate {
  return (key, params = {}) => {
    const message = lookup(MESSAGES[locale], key) ?? lookup(MESSAGES[DEFAULT_LOCALE], key) ?? key
    return message.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match))
  }
}
