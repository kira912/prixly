<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const head = useLocaleHead()

useHead(() => ({
  htmlAttrs: { lang: head.value.htmlAttrs?.lang },
  meta: [{ name: 'description', content: t('app.description') }],
}))

const languages = computed(() => locales.value.map(l => ({ code: l.code, name: l.name ?? l.code })))
</script>

<template>
  <NuxtPwaManifest />
  <header class="topbar">
    <NuxtLink to="/" class="brand">
      <img src="/icon.svg" alt="" width="28" height="28">
      <span>Prixly</span>
    </NuxtLink>
    <nav class="topbar-actions" :aria-label="t('nav.main')">
      <NuxtLink to="/search" class="btn btn-ghost btn-icon" :aria-label="t('nav.search')" :title="t('nav.search')">
        🔍
      </NuxtLink>
      <NuxtLink to="/watched" class="btn btn-ghost">
        {{ t('nav.watched') }}
      </NuxtLink>
      <NuxtLink to="/notifications" class="btn btn-ghost btn-icon" :aria-label="t('nav.notifications')" :title="t('nav.notifications')">
        🔔
      </NuxtLink>
      <select
        class="language-select"
        :value="locale"
        :aria-label="t('nav.language')"
        :title="t('nav.language')"
        @change="setLocale(($event.target as HTMLSelectElement).value as typeof locale)"
      >
        <option v-for="l in languages" :key="l.code" :value="l.code">
          {{ l.code.toUpperCase() }}
        </option>
      </select>
    </nav>
  </header>
  <main class="container">
    <NuxtPage />
  </main>
</template>
