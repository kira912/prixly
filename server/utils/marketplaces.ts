import { eq } from 'drizzle-orm'
import { marketplaceOffers, type MarketplaceOffer, type Product } from '../database/schema'
import { marketplaceRef, otherMarketplaces } from '../lib/marketplaces'
import { ExtractError } from '../lib/types'

/** Une comparaison plus récente est resservie telle quelle (double clic, rechargement). */
const FRESH_MS = 30 * 60 * 1000
/** Décalage entre deux requêtes : les pays sont relevés en parallèle, sans partir tous à la même milliseconde. */
const STAGGER_MS = 600

export async function getOffers(productId: number): Promise<MarketplaceOffer[]> {
  return (await useDb()).select().from(marketplaceOffers).where(eq(marketplaceOffers.productId, productId)).all()
}

/**
 * Relève le prix du même ASIN sur les autres Amazon européens.
 * Un captcha sur l'un d'eux met Amazon en retrait pour les relevés planifiés, comme tout relevé (extractTracked).
 */
export async function compareMarketplaces(product: Product): Promise<MarketplaceOffer[]> {
  const codes = otherMarketplaces(product)
  if (!codes.length) throw createError({ statusCode: 400, message: 'La comparaison entre pays n\'existe que pour Amazon.' })

  const existing = await getOffers(product.id)
  if (existing.length === codes.length && existing.every(o => Date.now() - o.fetchedAt.getTime() < FRESH_MS)) return existing

  const fetchedAt = new Date()
  const offers = await Promise.all(codes.map(async (code, i): Promise<MarketplaceOffer> => {
    await new Promise(resolve => setTimeout(resolve, i * STAGGER_MS))
    const ref = marketplaceRef(product.externalId, code)
    const base = { productId: product.id, marketplace: code, url: ref.url, fetchedAt }
    try {
      const info = await extractTracked(ref)
      return { ...base, status: info.priceCents == null ? 'unavailable' : 'ok', priceCents: info.priceCents, currency: info.currency, error: null }
    }
    catch (err) {
      const notFound = err instanceof ExtractError && err.code === 'not_found'
      return { ...base, status: notFound ? 'not_found' : 'error', priceCents: null, currency: null, error: notFound ? null : (err as Error).message }
    }
  }))

  const db = await useDb()
  for (const offer of offers) {
    await db.insert(marketplaceOffers).values(offer)
      .onConflictDoUpdate({ target: [marketplaceOffers.productId, marketplaceOffers.marketplace], set: offer })
      .run()
  }
  return offers
}
