import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  platform: text('platform', { enum: ['amazon', 'aliexpress'] }).notNull(),
  externalId: text('external_id').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  image: text('image'),
  currency: text('currency').notNull().default('EUR'),
  priceCents: integer('price_cents'),
  shippingCents: integer('shipping_cents'),
  /** Prix barré affiché par la plateforme (article seul, hors port) ; null si aucun */
  listPriceCents: integer('list_price_cents'),
  shippingNote: text('shipping_note'),
  deliveryMinDays: integer('delivery_min_days'),
  deliveryMaxDays: integer('delivery_max_days'),
  deliveryText: text('delivery_text'),
  rating: real('rating'),
  reviewCount: integer('review_count'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
  /** Statistiques du total (prix + port), tenues à jour à chaque relevé pour ne jamais relire l'historique */
  lowestCents: integer('lowest_cents'),
  highestCents: integer('highest_cents'),
  /** Total du palier précédent : dernier total différent de l'actuel */
  previousCents: integer('previous_cents'),
  /** Dernière tentative de relevé automatique, réussie ou non */
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp_ms' }),
  /** Message de la dernière erreur de relevé ; remis à null au prochain succès */
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
}, t => [
  uniqueIndex('products_platform_external_id').on(t.platform, t.externalId),
])

/**
 * Historique des prix, un palier par ligne : un relevé identique au précédent (même prix, même port)
 * ne crée pas de ligne, il repousse last_seen_at.
 */
export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  priceCents: integer('price_cents'),
  shippingCents: integer('shipping_cents'),
  currency: text('currency').notNull(),
  /** Premier relevé à ce prix */
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
  /** Dernier relevé confirmant ce prix (null sur les lignes antérieures à la migration 0003 : = captured_at) */
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
}, t => [
  index('price_snapshots_product_id').on(t.productId, t.capturedAt),
])

/** Un appareil (ou une personne), identifié par un cookie anonyme ; on ne stocke que le hash du jeton. */
export const subscribers = sqliteTable('subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

/** Abonnements Web Push d'un abonné (un par navigateur / appli installée). */
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  subscriberId: integer('subscriber_id').notNull().references(() => subscribers.id, { onDelete: 'cascade' }),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, t => [
  index('push_subscriptions_subscriber_id').on(t.subscriberId),
])

/** Un abonné suit un produit : la tâche planifiée relève son prix et le prévient des baisses. */
export const watches = sqliteTable('watches', {
  subscriberId: integer('subscriber_id').notNull().references(() => subscribers.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  /** Prévenir dès que le total passe sous ce montant */
  targetPriceCents: integer('target_price_cents'),
  /** Total au moment de la dernière alerte : on ne renvoie rien tant que le prix ne descend pas plus bas */
  lastNotifiedCents: integer('last_notified_cents'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, t => [
  primaryKey({ columns: [t.subscriberId, t.productId] }),
  index('watches_product_id').on(t.productId),
])

/** Produits consultés par un abonné : alimente « Consultés récemment », propre à chaque appareil. */
export const productViews = sqliteTable('product_views', {
  subscriberId: integer('subscriber_id').notNull().references(() => subscribers.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  viewedAt: integer('viewed_at', { mode: 'timestamp_ms' }).notNull(),
}, t => [
  primaryKey({ columns: [t.subscriberId, t.productId] }),
  index('product_views_recent').on(t.subscriberId, t.viewedAt),
])

/**
 * Prix du même produit (même ASIN) sur les autres Amazon européens, relevés à la demande depuis la fiche.
 * Un relevé par pays, remplacé au suivant : pas d'historique.
 */
export const marketplaceOffers = sqliteTable('marketplace_offers', {
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  /** fr, de, es, it, nl, be (server/lib/marketplaces.ts) */
  marketplace: text('marketplace').notNull(),
  url: text('url').notNull(),
  /** ok : prix relevé ; unavailable : page trouvée sans offre ; not_found : produit absent de ce pays ; error : relevé en échec */
  status: text('status', { enum: ['ok', 'unavailable', 'not_found', 'error'] }).notNull(),
  priceCents: integer('price_cents'),
  currency: text('currency'),
  error: text('error'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
}, t => [
  primaryKey({ columns: [t.productId, t.marketplace] }),
])

export type Product = typeof products.$inferSelect
export type Watch = typeof watches.$inferSelect
export type PriceSnapshot = typeof priceSnapshots.$inferSelect
export type MarketplaceOffer = typeof marketplaceOffers.$inferSelect

/**
 * Petit stockage clé / valeur partagé par toutes les instances (serverless) : compteurs anti-abus,
 * mise en retrait des plateformes après un captcha, verrou du relevé planifié.
 */
export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  /** JSON */
  value: text('value').notNull(),
  /** Au-delà, la ligne est ignorée puis purgée ; null = sans expiration */
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
}, t => [
  index('kv_expires_at').on(t.expiresAt),
])
