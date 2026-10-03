import { describe, expect, it } from 'vitest'
import { marketplaceOf, marketplaceRef, otherMarketplaces } from '../server/lib/marketplaces'

describe('marketplaces', () => {
  it('reconnaît le pays d\'une URL Amazon', () => {
    expect(marketplaceOf('https://www.amazon.de/dp/B06VW5BH2K')).toBe('de')
    expect(marketplaceOf('https://www.amazon.com.be/dp/B06VW5BH2K')).toBe('be')
    expect(marketplaceOf('https://www.amazon.com/dp/B06VW5BH2K')).toBeNull()
  })

  it('construit l\'URL du même ASIN dans un autre pays', () => {
    expect(marketplaceRef('B06VW5BH2K', 'it')).toEqual({ platform: 'amazon', externalId: 'B06VW5BH2K', url: 'https://www.amazon.it/dp/B06VW5BH2K' })
  })

  it('interroge tous les autres pays, pas celui du produit', () => {
    expect(otherMarketplaces({ platform: 'amazon', externalId: 'B06VW5BH2K', url: 'https://www.amazon.fr/dp/B06VW5BH2K' }))
      .toEqual(['de', 'es', 'it', 'nl', 'be'])
  })

  it('ne compare pas AliExpress', () => {
    expect(otherMarketplaces({ platform: 'aliexpress', externalId: '1', url: 'https://fr.aliexpress.com/item/1.html' })).toEqual([])
  })
})
