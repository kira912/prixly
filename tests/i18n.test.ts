import { describe, expect, it } from 'vitest'
import en from '../i18n/locales/en.json'
import fr from '../i18n/locales/fr.json'
import { formatAlert } from '../server/lib/alerts'
import { localeFromAcceptLanguage, toLocale, translator } from '../server/lib/i18n'

function keys(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k)).sort()
}

const params = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort()

describe('locale files', () => {
  it('have the same keys', () => {
    expect(keys(en)).toEqual(keys(fr))
  })

  it('use the same placeholders', () => {
    const t = { fr: translator('fr'), en: translator('en') }
    for (const key of keys(fr)) {
      expect(params(t.en(key)), key).toEqual(params(t.fr(key)))
    }
  })
})

describe('toLocale', () => {
  it('keeps supported languages only', () => {
    expect(toLocale('en-US')).toBe('en')
    expect(toLocale('FR')).toBe('fr')
    expect(toLocale('de')).toBeNull()
    expect(toLocale(undefined)).toBeNull()
  })
})

describe('localeFromAcceptLanguage', () => {
  it('picks the best supported language', () => {
    expect(localeFromAcceptLanguage('de-DE,de;q=0.9,en;q=0.8,fr;q=0.7')).toBe('en')
    expect(localeFromAcceptLanguage('fr-FR,fr;q=0.9')).toBe('fr')
    expect(localeFromAcceptLanguage('de-DE')).toBeNull()
    expect(localeFromAcceptLanguage(undefined)).toBeNull()
  })
})

describe('translator', () => {
  it('fills placeholders and falls back to the key', () => {
    const t = translator('en')
    expect(t('errors.tooManyWatches', { max: 50 })).toBe('You\'re already watching 50 products: stop watching one to add another.')
    expect(t('errors.missing')).toBe('errors.missing')
  })
})

describe('formatAlert in English', () => {
  it('uses English wording and number formats', () => {
    const m = formatAlert('target', { title: 'USB-C cable', currency: 'EUR' }, 446, 399, 400, 'en')
    expect(m.body).toBe('€4.46 → €3.99 (-11%) · below your target of €4.00 (shipping included)')
  })
})
