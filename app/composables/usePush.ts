type PushStatus =
  | 'loading'
  | 'unsupported'
  | 'server-disabled'
  | 'denied'
  | 'available'
  | 'subscribed'

const status = ref<PushStatus>('loading')
const busy = ref(false)
const error = ref<string | null>(null)
let publicKey: string | null = null
let initialized: Promise<void> | null = null
let translate: (key: string) => string = key => key

function base64UrlToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const timeout = new Promise<never>((_, reject) => setTimeout(
    () => reject(new Error(translate('push.swUnavailable'))),
    8000,
  ))
  return Promise.race([navigator.serviceWorker.ready, timeout])
}

async function init() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    status.value = 'unsupported'
    return
  }
  try {
    const config = await $fetch<{ enabled: boolean, publicKey: string | null }>('/api/push/config')
    publicKey = config.publicKey
    if (!config.enabled || !publicKey) {
      status.value = 'server-disabled'
      return
    }
    if (Notification.permission === 'denied') {
      status.value = 'denied'
      return
    }
    const existing = Notification.permission === 'granted'
      ? await (await registration()).pushManager.getSubscription()
      : null
    if (existing) {
      await $fetch('/api/push/subscription', { method: 'POST', body: existing.toJSON() })
      status.value = 'subscribed'
    }
    else {
      status.value = 'available'
    }
  }
  catch (err) {
    error.value = errorMessage(err)
    status.value = 'available'
  }
}

export function usePush() {
  const { $i18n } = useNuxtApp()
  translate = key => $i18n.t(key)
  if (import.meta.client && !initialized) initialized = init()

  async function enable(): Promise<boolean> {
    busy.value = true
    error.value = null
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        status.value = permission === 'denied' ? 'denied' : 'available'
        return false
      }
      await initialized
      if (!publicKey) throw new Error(translate('push.notConfigured'))

      const reg = await registration()
      const sub = await reg.pushManager.getSubscription()
        ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) })
      await $fetch('/api/push/subscription', { method: 'POST', body: sub.toJSON() })
      status.value = 'subscribed'
      return true
    }
    catch (err) {
      error.value = errorMessage(err)
      return false
    }
    finally {
      busy.value = false
    }
  }

  async function disable() {
    busy.value = true
    error.value = null
    try {
      const sub = await (await registration()).pushManager.getSubscription()
      if (sub) {
        await $fetch('/api/push/subscription', { method: 'DELETE', body: { endpoint: sub.endpoint } })
        await sub.unsubscribe()
      }
      status.value = 'available'
    }
    catch (err) {
      error.value = errorMessage(err)
    }
    finally {
      busy.value = false
    }
  }

  async function sendTest() {
    busy.value = true
    error.value = null
    try {
      await $fetch('/api/push/test', { method: 'POST' })
    }
    catch (err) {
      error.value = errorMessage(err)
    }
    finally {
      busy.value = false
    }
  }

  return { status: readonly(status), busy: readonly(busy), error: readonly(error), enable, disable, sendTest }
}
