import { and, eq, sql } from 'drizzle-orm'
import { products, subscribers, watches, type Product, type Watch } from '../database/schema'
import { alertReason, formatAlert, shouldResetNotified } from '../lib/alerts'
import { snapshotTotal } from '../lib/history'
import { DEFAULT_LOCALE, toLocale } from '../lib/i18n'

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

export async function setWatch(subscriberId: number, productId: number, { targetPriceCents }: { targetPriceCents: number | null }): Promise<Watch | null> {
  const db = await useDb()
  if (!await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).get()) return null
  return db.insert(watches)
    .values({ subscriberId, productId, targetPriceCents, createdAt: new Date() })
    .onConflictDoUpdate({ target: [watches.subscriberId, watches.productId], set: { targetPriceCents } })
    .returning()
    .get()
}

export async function removeWatch(subscriberId: number, productId: number) {
  await (await useDb()).delete(watches).where(and(eq(watches.subscriberId, subscriberId), eq(watches.productId, productId))).run()
}

export async function notifyWatchers(product: Product, previousCents: number | null, lowestBeforeCents: number | null): Promise<number> {
  const db = await useDb()
  const currentCents = snapshotTotal(product)
  const rows = await db.select({ watch: watches, locale: subscribers.locale }).from(watches)
    .innerJoin(subscribers, eq(subscribers.id, watches.subscriberId))
    .where(eq(watches.productId, product.id))
    .all()

  let notified = 0
  for (const { watch: w, locale } of rows) {
    let lastNotifiedCents = w.lastNotifiedCents
    if (shouldResetNotified(lastNotifiedCents, currentCents)) {
      lastNotifiedCents = null
      await db.update(watches).set({ lastNotifiedCents: null }).where(and(eq(watches.subscriberId, w.subscriberId), eq(watches.productId, w.productId))).run()
    }

    const reason = alertReason({ previousCents, currentCents, lowestBeforeCents, targetPriceCents: w.targetPriceCents, lastNotifiedCents })
    if (!reason || currentCents == null) continue

    const message = formatAlert(reason, product, previousCents, currentCents, w.targetPriceCents, toLocale(locale) ?? DEFAULT_LOCALE)
    const sent = await sendToSubscriber(w.subscriberId, {
      ...message,
      url: `/product/${product.id}`,
      image: product.image,
      tag: `product-${product.id}`,
    })
    await db.update(watches).set({ lastNotifiedCents: currentCents }).where(and(eq(watches.subscriberId, w.subscriberId), eq(watches.productId, w.productId))).run()
    if (sent) notified++
  }
  return notified
}
