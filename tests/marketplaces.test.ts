import { describe, expect, it } from 'vitest'
import { marketplaceOf, marketplaceRef, otherMarketplaces } from '../server/lib/marketplaces'

describe('marketplaces', () => {
  it('recognizes the country of an Amazon URL', () => {
    expect(marketplaceOf('https://www.amazon.de/dp/B06VW5BH2K')).toBe('de')
    expect(marketplaceOf('https://www.amazon.com.be/dp/B06VW5BH2K')).toBe('be')
    expect(marketplaceOf('https://www.amazon.com/dp/B06VW5BH2K')).toBeNull()
  })

  it('builds the URL of the same ASIN in another country', () => {
    expect(marketplaceRef('B06VW5BH2K', 'it')).toEqual({ platform: 'amazon', externalId: 'B06VW5BH2K', url: 'https://www.amazon.it/dp/B06VW5BH2K' })
  })

  it('queries every other country, not the product\'s own', () => {
    expect(otherMarketplaces({ platform: 'amazon', externalId: 'B06VW5BH2K', url: 'https://www.amazon.fr/dp/B06VW5BH2K' }))
      .toEqual(['de', 'es', 'it', 'nl', 'be'])
  })

  it('doesn\'t compare AliExpress', () => {
    expect(otherMarketplaces({ platform: 'aliexpress', externalId: '1', url: 'https://fr.aliexpress.com/item/1.html' })).toEqual([])
  })
})
