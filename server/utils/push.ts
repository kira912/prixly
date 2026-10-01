import { eq, sql } from 'drizzle-orm'
import webpush, { WebPushError } from 'web-push'
import { pushSubscriptions } from '../database/schema'

export interface PushPayload {
  title: string
  body: string
  /** Page ouverte au tap sur la notification */
  url: string
  image?: string | null
  /** Une notification par produit : la suivante remplace la précédente */
  tag?: string
}

let configured: boolean | undefined

export function pushEnabled(): boolean {
  if (configured !== undefined) return configured
  const { vapidPublicKey, vapidPrivateKey, vapidSubject } = useRuntimeConfig()
  configured = Boolean(vapidPublicKey && vapidPrivateKey)
  if (configured) webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey)
  else console.warn('[push] NUXT_VAPID_PUBLIC_KEY / NUXT_VAPID_PRIVATE_KEY absents : notifications désactivées')
  return configured
}

export async function saveSubscription(subscriberId: number, sub: { endpoint: string, keys: { p256dh: string, auth: string } }) {
  const values = { subscriberId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: new Date() }
  await (await useDb()).insert(pushSubscriptions).values(values)
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: values })
    .run()
}

export async function deleteSubscription(subscriberId: number, endpoint: string) {
  const db = await useDb()
  const row = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).get()
  if (row?.subscriberId === subscriberId) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, row.id)).run()
}

export async function countSubscriptions(subscriberId: number): Promise<number> {
  const db = await useDb()
  return (await db.select({ n: sql<number>`count(*)` }).from(pushSubscriptions).where(eq(pushSubscriptions.subscriberId, subscriberId)).get())?.n ?? 0
}

/**
 * Envoie une notification à tous les appareils d'un abonné.
 * Les abonnements expirés (404 / 410 : appli désinstallée, permission retirée) sont supprimés.
 * Renvoie le nombre d'envois réussis.
 */
export async function sendToSubscriber(subscriberId: number, payload: PushPayload): Promise<number> {
  if (!pushEnabled()) return 0
  const db = await useDb()
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.subscriberId, subscriberId)).all()

  let sent = 0
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 60 * 60, urgency: 'normal', topic: payload.tag?.slice(0, 32) },
      )
      sent++
    }
    catch (err) {
      if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).run()
      }
      else {
        console.warn(`[push] échec d'envoi à l'abonnement #${s.id} : ${(err as Error).message}`)
      }
    }
  }))
  return sent
}
