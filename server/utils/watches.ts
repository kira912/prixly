import { and, eq, sql } from 'drizzle-orm'
import { products, watches, type Product, type Watch } from '../database/schema'
import { alertReason, formatAlert, shouldResetNotified } from '../lib/alerts'
import { snapshotTotal } from '../lib/history'

export async function getWatch(subscriberId: number | null, productId: number): Promise<Watch | null> {
  if (subscriberId == null) return null
  const db = await useDb()
  return await db.select().from(watches)
    .where(and(eq(watches.subscriberId, subscriberId), eq(watches.productId, productId)))
    .get() ?? null
}

export async function countWatches(subscriberId: number): Promise<number> {
  const db = await useDb()
  return (await db.select({ n: sql<number>`count(*)` }).from(watches).where(eq(watches.subscriberId, subscriberId)).get())?.n ?? 0
}

export async function setWatch(subscriberId: number, productId: number, { targetPriceCents }: { targetPriceCents: number | null }): Promise<Watch> {
  const db = await useDb()
  if (!await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get()) {
    throw createError({ statusCode: 404, message: 'Produit inconnu.' })
  }
  return db.insert(watches)
    .values({ subscriberId, productId, targetPriceCents, createdAt: new Date() })
    .onConflictDoUpdate({ target: [watches.subscriberId, watches.productId], set: { targetPriceCents } })
    .returning()
    .get()
}

export async function removeWatch(subscriberId: number, productId: number) {
  await (await useDb()).delete(watches).where(and(eq(watches.subscriberId, subscriberId), eq(watches.productId, productId))).run()
}

/**
 * Applique les règles d'alerte (voir lib/alerts.ts) à chaque abonné qui suit ce produit
 * et envoie les notifications. Renvoie le nombre d'abonnés prévenus.
 */
export async function notifyWatchers(product: Product, previousCents: number | null, lowestBeforeCents: number | null): Promise<number> {
  const db = await useDb()
  const currentCents = snapshotTotal(product)
  const rows = await db.select().from(watches).where(eq(watches.productId, product.id)).all()

  let notified = 0
  for (const w of rows) {
    let lastNotifiedCents = w.lastNotifiedCents
    if (shouldResetNotified(lastNotifiedCents, currentCents)) {
      lastNotifiedCents = null
      await db.update(watches).set({ lastNotifiedCents: null }).where(and(eq(watches.subscriberId, w.subscriberId), eq(watches.productId, w.productId))).run()
    }

    const reason = alertReason({ previousCents, currentCents, lowestBeforeCents, targetPriceCents: w.targetPriceCents, lastNotifiedCents })
    if (!reason || currentCents == null) continue

    const message = formatAlert(reason, product, previousCents, currentCents, w.targetPriceCents)
    const sent = await sendToSubscriber(w.subscriberId, {
      ...message,
      url: `/product/${product.id}`,
      image: product.image,
      tag: `product-${product.id}`,
    })
    // Même sans appareil joignable, on retient le niveau : pas de rafale d'anciennes alertes plus tard
    await db.update(watches).set({ lastNotifiedCents: currentCents }).where(and(eq(watches.subscriberId, w.subscriberId), eq(watches.productId, w.productId))).run()
    if (sent) notified++
  }
  return notified
}
