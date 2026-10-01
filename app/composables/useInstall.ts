/**
 * Contexte d'installation de la PWA, pour expliquer comment avoir Prixly dans le menu « Partager ».
 * Valeurs significatives côté client uniquement (à utiliser sous <ClientOnly>).
 */
export function useInstall() {
  const pwa = useNuxtApp().$pwa
  const standalone = ref(false)
  const platform = ref<'android' | 'ios' | 'desktop'>('desktop')

  onMounted(() => {
    standalone.value = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const ua = navigator.userAgent
    platform.value = /android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : 'desktop'
  })

  /** Chrome propose l'installation (événement beforeinstallprompt reçu) */
  const canPrompt = computed(() => Boolean(pwa?.showInstallPrompt))

  return { standalone, platform, canPrompt, install: () => pwa?.install() }
}
