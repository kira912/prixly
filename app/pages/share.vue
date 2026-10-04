<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { loading, error, lookup } = useLookup()

const shared = computed(() => {
  const q = route.query
  return [q.url, q.text, q.title].filter(v => typeof v === 'string' && v).join(' ')
})

onMounted(() => {
  if (!shared.value) return
  if (!looksLikeLink(shared.value)) return navigateTo({ path: '/search', query: { q: shared.value } }, { replace: true })
  lookup(shared.value, { replace: true })
})
</script>

<template>
  <section class="hero">
    <template v-if="!shared">
      <h1>{{ t('share.nothingTitle') }}</h1>
      <p class="muted">
        {{ t('share.nothingText') }}
      </p>
      <LinkForm :loading="loading" @submit="lookup" />
    </template>
    <template v-else-if="error">
      <h1>{{ t('share.errorTitle') }}</h1>
      <p class="alert" role="alert">
        {{ error }}
      </p>
      <p class="muted small shared-text">
        {{ shared }}
      </p>
      <div class="actions">
        <button class="btn btn-primary" @click="lookup(shared, { replace: true })">
          {{ t('common.retry') }}
        </button>
        <NuxtLink to="/" class="btn btn-ghost">
          {{ t('common.home') }}
        </NuxtLink>
      </div>
    </template>
    <div v-else class="loading-state" aria-live="polite">
      <div class="spinner" />
      <p>{{ t('share.analyzing') }}</p>
    </div>
  </section>
</template>
