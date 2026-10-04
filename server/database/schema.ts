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
  listPriceCents: integer('list_price_cents'),
  shippingNote: text('shipping_note'),
  freeShippingOver: text('free_shipping_over'),
  shipsFrom: text('ships_from'),
  deliveryMinDays: integer('delivery_min_days'),
  deliveryMaxDays: integer('delivery_max_days'),
  deliveryText: text('delivery_text'),
  rating: real('rating'),
  reviewCount: integer('review_count'),
  fetchedAt: integer('fetched_at', { mode: 'timestamp_ms' }).notNull(),
  lowestCents: integer('lowest_cents'),
  highestCents: integer('highest_cents'),
  previousCents: integer('previous_cents'),
  lastCheckedAt: integer('last_checked_at', { mode: 'timestamp_ms' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().default(sql`(unixepoch() * 1000)`),
}, t => [
  uniqueIndex('products_platform_external_id').on(t.platform, t.externalId),
])

export const priceSnapshots = sqliteTable('price_snapshots', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  priceCents: integer('price_cents'),
  shippingCents: integer('shipping_cents'),
  currency: text('currency').notNull(),
  capturedAt: integer('captured_at', { mode: 'timestamp_ms' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp_ms' }),
}, t => [
  index('price_snapshots_product_id').on(t.productId, t.capturedAt),
])

export const subscribers = sqliteTable('subscribers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  locale: text('locale'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
})

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

export const watches = sqliteTable('watches', {
  subscriberId: integer('subscriber_id').notNull().references(() => subscribers.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  targetPriceCents: integer('target_price_cents'),
  lastNotifiedCents: integer('last_notified_cents'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, t => [
  primaryKey({ columns: [t.subscriberId, t.productId] }),
  index('watches_product_id').on(t.productId),
])

export const productViews = sqliteTable('product_views', {
  subscriberId: integer('subscriber_id').notNull().references(() => subscribers.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  viewedAt: integer('viewed_at', { mode: 'timestamp_ms' }).notNull(),
}, t => [
  primaryKey({ columns: [t.subscriberId, t.productId] }),
  index('product_views_recent').on(t.subscriberId, t.viewedAt),
])

export const marketplaceOffers = sqliteTable('marketplace_offers', {
  productId: integer('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  marketplace: text('marketplace').notNull(),
  url: text('url').notNull(),
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

export const kv = sqliteTable('kv', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
}, t => [
  index('kv_expires_at').on(t.expiresAt),
])
