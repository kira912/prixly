/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title: string
  body: string
  url: string
  image?: string | null
  tag?: string
}

self.addEventListener('push', (event) => {
  let data: PushPayload
  try {
    data = event.data?.json() as PushPayload
  }
  catch {
    data = { title: 'Prixly', body: event.data?.text() ?? '', url: '/' }
  }

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    ...(data.image ? { image: data.image } : {}),
    tag: data.tag,
    renotify: Boolean(data.tag),
    data: { url: data.url },
  } as NotificationOptions))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL((event.notification.data as { url?: string } | null)?.url ?? '/', self.location.origin).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const client = windows.find(w => new URL(w.url).origin === self.location.origin)
    if (client) {
      await client.focus()
      await client.navigate(url)
      return
    }
    await self.clients.openWindow(url)
  })())
})
