import type { ProductRef } from './types'

/**
 * Amazon européens en euros : même ASIN d'un pays à l'autre, prix comparables sans conversion.
 * (amazon.co.uk est exclu : livre sterling et droits de douane depuis le Brexit.)
 */
export const AMAZON_MARKETPLACES = [
  { code: 'fr', host: 'www.amazon.fr', country: 'France', flag: '🇫🇷' },
  { code: 'de', host: 'www.amazon.de', country: 'Allemagne', flag: '🇩🇪' },
  { code: 'es', host: 'www.amazon.es', country: 'Espagne', flag: '🇪🇸' },
  { code: 'it', host: 'www.amazon.it', country: 'Italie', flag: '🇮🇹' },
  { code: 'nl', host: 'www.amazon.nl', country: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'be', host: 'www.amazon.com.be', country: 'Belgique', flag: '🇧🇪' },
] as const

export type MarketplaceCode = typeof AMAZON_MARKETPLACES[number]['code']

/** Marketplace d'une URL produit Amazon (www.amazon.de/dp/… → de), ou null hors de la liste. */
export function marketplaceOf(url: string): MarketplaceCode | null {
  const host = new URL(url).hostname
  return AMAZON_MARKETPLACES.find(m => m.host === host)?.code ?? null
}

/** Le même produit sur un autre Amazon. */
export function marketplaceRef(asin: string, code: MarketplaceCode): ProductRef {
  const m = AMAZON_MARKETPLACES.find(m => m.code === code)!
  return { platform: 'amazon', externalId: asin, url: `https://${m.host}/dp/${asin}` }
}

/** Les autres Amazon à interroger pour un produit (tous sauf le sien). */
export function otherMarketplaces(ref: ProductRef): MarketplaceCode[] {
  if (ref.platform !== 'amazon') return []
  const own = marketplaceOf(ref.url)
  return AMAZON_MARKETPLACES.map(m => m.code).filter(c => c !== own)
}
