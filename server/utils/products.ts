import { and, asc, desc, eq, exists, isNull, lt, notExists, or, sql } from 'drizzle-orm'
import { priceSnapshots, products, productViews, watches, type Product } from '../database/schema'
import { interleaveByPlatform, nextBackoff, type BackoffState } from '../lib/pacing'
import { extractProduct } from '../lib/extractors'
import { nextStats, samePrice, snapshotTotal, statsOf, toPricePoints, type PriceStats } from '../lib/history'
import { resolveProductRef } from '../lib/links'
import { ExtractError, type Platform, type ProductInfo, type ProductRef } from '../lib/types'

/** Durée pendant laquelle on sert la version en base sans refrapper la plateforme. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000

/** Plateformes en retrait après un captcha, en base (table kv) pour être communes à toutes les instances. */
const backoffKey = (platform: Platform) => `backoff:${platform}`

async function backoffRemainingMs(platform: Platform): Promise<number> {
  const state = await kvGet<BackoffState>(backoffKey(platform))
  return Math.max(0, (state?.until ?? 0) - Date.now())
}

/** Relève un produit en tenant le compte des blocages, quel que soit le déclencheur. */
async function extractTracked(ref: ProductRef): Promise<ProductInfo> {
  try {
    const info = await extractProduct(ref)
    await kvDelete(backoffKey(ref.platform))
    return info
  }
  catch (err) {
    if (err instanceof ExtractError && err.code === 'blocked') {
      const { strikes, until } = nextBackoff(await kvGet<BackoffState>(backoffKey(ref.platform)))
      // Les blocages restent comptés une semaine : au-delà, on repart de l'attente de base
      await kvSet(backoffKey(ref.platform), { strikes, until }, { ttlSec: 7 * 24 * 3600 })
      console.warn(`[backoff] ${ref.platform} bloqué (${strikes}e fois d'affilée), relevés planifiés suspendus jusqu'à ${new Date(until).toISOString()}`)
    }
    throw err
  }
}

export async function lookupProduct(input: string, { refresh = false } = {}): Promise<{ product: Product, cached: boolean }> {
  const ref = await resolveProductRef(input)
  return fetchAndStore(ref, { refresh })
}

export async function refreshProduct(id: number): Promise<Product> {
  const existing = await getProduct(id)
  if (!existing) throw createError({ statusCode: 404, message: 'Produit inconnu.' })
  const { product } = await fetchAndStore(toRef(existing), { refresh: true })
  return product
}

function toRef(p: Product): ProductRef {
  return { platform: p.platform, externalId: p.externalId, url: p.url }
}

async function fetchAndStore(ref: ProductRef, { refresh }: { refresh: boolean }): Promise<{ product: Product, cached: boolean }> {
  const db = await useDb()
  const existing = await db.select().from(products)
    .where(and(eq(products.platform, ref.platform), eq(products.externalId, ref.externalId)))
    .get()

  if (existing && !refresh && Date.now() - existing.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { product: existing, cached: true }
  }

  const { product } = await recordReading(await extractTracked(ref))
  return { product, cached: false }
}

interface Reading {
  product: Product
  previousCents: number | null
  notified: number
}

/**
 * Enregistre un relevé puis prévient les abonnés qui suivent le produit.
 * Tout relevé passe par ici (partage, bouton « Actualiser », tâche planifiée) :
 * une baisse n'est jamais manquée, quel que soit le déclencheur.
 */
async function recordReading(info: ProductInfo): Promise<Reading> {
  const db = await useDb()
  const now = new Date()
  const values = { ...info, fetchedAt: now, lastCheckedAt: now, lastError: null }

  const { product, previousCents, lowestBeforeCents } = await db.transaction(async (tx) => {
    const before = await tx.select().from(products)
      .where(and(eq(products.platform, info.platform), eq(products.externalId, info.externalId)))
      .get()
    const previousCents = before ? snapshotTotal(before) : null
    const stats = nextStats(before ? { ...before, currentCents: previousCents } : null, snapshotTotal(info))

    const product = await tx.insert(products).values({ ...values, ...stats })
      .onConflictDoUpdate({ target: [products.platform, products.externalId], set: { ...values, ...stats } })
      .returning()
      .get()

    // Même prix et même port que le dernier palier : on le prolonge au lieu d'ajouter une ligne
    const last = await tx.select().from(priceSnapshots)
      .where(eq(priceSnapshots.productId, product.id))
      .orderBy(desc(priceSnapshots.capturedAt))
      .limit(1)
      .get()
    if (last && samePrice(last, info) && last.currency === info.currency) {
      await tx.update(priceSnapshots).set({ lastSeenAt: now }).where(eq(priceSnapshots.id, last.id)).run()
    }
    else {
      await tx.insert(priceSnapshots).values({
        productId: product.id,
        priceCents: info.priceCents,
        shippingCents: info.shippingCents,
        currency: info.currency,
        capturedAt: now,
        lastSeenAt: now,
      }).run()
    }

    return { product, previousCents, lowestBeforeCents: before?.lowestCents ?? null }
  })

  let notified = 0
  try {
    notified = await notifyWatchers(product, previousCents, lowestBeforeCents)
  }
  catch (err) {
    // Une panne d'envoi ne doit pas faire échouer le relevé lui-même
    console.warn(`[push] alertes non envoyées pour #${product.id} : ${(err as Error).message}`)
  }
  return { product, previousCents, notified }
}

export async function getProduct(id: number): Promise<Product | undefined> {
  return (await useDb()).select().from(products).where(eq(products.id, id)).get()
}

export type ProductWithStats = Product & { stats: PriceStats, watched: boolean }

const withStats = (p: Product, watched: boolean): ProductWithStats => ({ ...p, stats: statsOf(p), watched })

/** Produits suivis par l'abonné, du plus récemment suivi au plus ancien. Une lecture par produit. */
export async function listWatched(subscriberId: number | null, limit?: number): Promise<{ items: ProductWithStats[], total: number }> {
  if (subscriberId == null) return { items: [], total: 0 }
  const db = await useDb()
  const query = db.select({ product: products }).from(watches)
    .innerJoin(products, eq(products.id, watches.productId))
    .where(eq(watches.subscriberId, subscriberId))
    .orderBy(desc(watches.createdAt))
  const rows = await (limit ? query.limit(limit) : query).all()
  const total = limit
    ? (await db.select({ n: sql<number>`count(*)` }).from(watches).where(eq(watches.subscriberId, subscriberId)).get())?.n ?? 0
    : rows.length
  return { items: rows.map(r => withStats(r.product, true)), total }
}

/** Derniers produits consultés par l'abonné, hors produits suivis (déjà listés à part). */
export async function listRecent(subscriberId: number | null, limit = 5): Promise<ProductWithStats[]> {
  if (subscriberId == null) return []
  const db = await useDb()
  const rows = await db.select({ product: products }).from(productViews)
    .innerJoin(products, eq(products.id, productViews.productId))
    .where(and(
      eq(productViews.subscriberId, subscriberId),
      notExists(db.select({ one: sql`1` }).from(watches).where(and(eq(watches.subscriberId, subscriberId), eq(watches.productId, productViews.productId)))),
    ))
    .orderBy(desc(productViews.viewedAt))
    .limit(limit)
    .all()
  return rows.map(r => withStats(r.product, false))
}

export async function recordView(subscriberId: number, productId: number) {
  const viewedAt = new Date()
  await (await useDb()).insert(productViews).values({ subscriberId, productId, viewedAt })
    .onConflictDoUpdate({ target: [productViews.subscriberId, productViews.productId], set: { viewedAt } })
    .run()
}

/** Historique d'un produit : quelques dizaines de paliers, pas un relevé par passage. */
export async function getPriceHistory(product: Product) {
  const snapshots = await (await useDb()).select().from(priceSnapshots)
    .where(eq(priceSnapshots.productId, product.id))
    .orderBy(asc(priceSnapshots.capturedAt))
    .all()
  return { points: toPricePoints(snapshots), stats: statsOf(product) }
}

export interface RefreshReport {
  checked: number
  changed: Array<{ id: number, title: string, fromCents: number | null, toCents: number | null }>
  notified: number
  failed: Array<{ id: number, error: string }>
  skippedPlatforms: Platform[]
  /** Produits dus laissés au passage suivant faute de temps (budgetMs) */
  pending: number
  /** Un autre relevé tournait déjà : rien n'a été fait */
  busy?: boolean
}

export interface RefreshOptions {
  /** Âge minimal du dernier relevé pour qu'un produit soit relevé */
  minAgeMs?: number
  /** Pause aléatoire entre deux requêtes [min, max] */
  pauseMs?: [number, number]
  /**
   * Durée maximale du passage (fonction serverless) : on n'entame plus de produit s'il risque de la dépasser,
   * le reste est repris au passage suivant (les plus anciens relevés passent en premier).
   */
  budgetMs?: number
}

/** Pire durée d'un relevé (timeout HTTP de 15 s, redirections, écriture) : marge avant d'entamer un produit. */
const WORST_FETCH_MS = 20_000

const REFRESH_LOCK = 'lock:prices-refresh'

/**
 * Relève le prix des produits suivis par au moins un abonné, dont le dernier relevé date de plus de minAgeMs.
 * Séquentiel avec une pause aléatoire entre deux requêtes, en alternant les plateformes pour espacer
 * les requêtes vers chacune. Si une plateforme renvoie un captcha, ses produits restants sont reportés
 * et elle est mise en retrait (voir backoffRemainingMs) plutôt que d'insister.
 * Un verrou en base empêche deux passages simultanés, même sur deux instances.
 */
export async function refreshWatchedProducts({ minAgeMs = 60 * 60 * 1000, pauseMs = [3000, 8000], budgetMs }: RefreshOptions = {}): Promise<RefreshReport> {
  const startedAt = Date.now()
  const report: RefreshReport = { checked: 0, changed: [], notified: 0, failed: [], skippedPlatforms: [], pending: 0 }
  const lockTtlSec = Math.ceil((budgetMs ?? 2 * 60 * 60 * 1000) / 1000) + 60
  if (!await kvAcquire(REFRESH_LOCK, lockTtlSec)) return { ...report, busy: true }

  try {
    const db = await useDb()
    const threshold = new Date(Date.now() - minAgeMs)
    const due = await db.select().from(products)
      .where(and(
        exists(db.select({ one: sql`1` }).from(watches).where(eq(watches.productId, products.id))),
        or(isNull(products.lastCheckedAt), lt(products.lastCheckedAt, threshold)),
      ))
      .orderBy(asc(products.lastCheckedAt))
      .all()

    const blocked = new Set<Platform>()
    for (const platform of new Set(due.map(p => p.platform))) {
      if (await backoffRemainingMs(platform) > 0) blocked.add(platform)
    }
    const queue = interleaveByPlatform(due)
    let first = true
    for (const [i, p] of queue.entries()) {
      if (blocked.has(p.platform)) continue
      const pause = first ? 0 : pauseMs[0] + Math.random() * (pauseMs[1] - pauseMs[0])
      if (budgetMs != null && Date.now() - startedAt + pause + WORST_FETCH_MS > budgetMs) {
        report.pending = queue.slice(i).filter(q => !blocked.has(q.platform)).length
        break
      }
      if (pause) await sleep(pause)
      first = false

      report.checked++
      try {
        const { product, previousCents, notified } = await recordReading(await extractTracked(toRef(p)))
        const after = snapshotTotal(product)
        if (after !== previousCents) report.changed.push({ id: p.id, title: p.title, fromCents: previousCents, toCents: after })
        report.notified += notified
      }
      catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await db.update(products).set({ lastCheckedAt: new Date(), lastError: message }).where(eq(products.id, p.id)).run()
        report.failed.push({ id: p.id, error: message })
        if (err instanceof ExtractError && err.code === 'blocked') blocked.add(p.platform)
      }
    }
    report.skippedPlatforms = [...blocked]
    await kvPurgeExpired()
    return report
  }
  finally {
    await kvDelete(REFRESH_LOCK)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const STATUS_BY_CODE: Record<ExtractError['code'], number> = {
  unsupported: 422,
  not_found: 404,
  blocked: 503,
  parse: 502,
  network: 502,
}

/** Convertit une erreur d'extraction en erreur HTTP lisible côté client. */
export function toHttpError(err: unknown) {
  if (err instanceof ExtractError) {
    return createError({ statusCode: STATUS_BY_CODE[err.code], message: err.message, data: { code: err.code, message: err.message } })
  }
  return err
}
