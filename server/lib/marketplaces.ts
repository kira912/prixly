import type { ProductRef } from './types'

export const AMAZON_MARKETPLACES = [
  { code: 'fr', host: 'www.amazon.fr', flag: '🇫🇷' },
  { code: 'de', host: 'www.amazon.de', flag: '🇩🇪' },
  { code: 'es', host: 'www.amazon.es', flag: '🇪🇸' },
  { code: 'it', host: 'www.amazon.it', flag: '🇮🇹' },
  { code: 'nl', host: 'www.amazon.nl', flag: '🇳🇱' },
  { code: 'be', host: 'www.amazon.com.be', flag: '🇧🇪' },
] as const

export type MarketplaceCode = typeof AMAZON_MARKETPLACES[number]['code']

export function marketplaceOf(url: string): MarketplaceCode | null {
  const host = new URL(url).hostname
  return AMAZON_MARKETPLACES.find(m => m.host === host)?.code ?? null
}

export function marketplaceRef(asin: string, code: MarketplaceCode): ProductRef {
  const m = AMAZON_MARKETPLACES.find(m => m.code === code)!
  return { platform: 'amazon', externalId: asin, url: `https://${m.host}/dp/${asin}` }
}

export function otherMarketplaces(ref: ProductRef): MarketplaceCode[] {
  if (ref.platform !== 'amazon') return []
  const own = marketplaceOf(ref.url)
  return AMAZON_MARKETPLACES.map(m => m.code).filter(c => c !== own)
}
