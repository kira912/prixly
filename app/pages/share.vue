<script setup lang="ts">
// Cible du Web Share Target (voir manifest.share_target dans nuxt.config.ts).
// Android envoie ?title=…&text=…&url=… ; selon l'appli, le lien arrive dans url ou dans text.
const route = useRoute()
const { loading, error, lookup } = useLookup()

const shared = computed(() => {
  const q = route.query
  return [q.url, q.text, q.title].filter(v => typeof v === 'string' && v).join(' ')
})

onMounted(() => {
  if (shared.value) lookup(shared.value, { replace: true })
})
</script>

<template>
  <section class="hero">
    <template v-if="!shared">
      <h1>Rien à analyser</h1>
      <p class="muted">
        Aucun lien n'a été reçu.
      </p>
      <LinkForm :loading="loading" @submit="lookup" />
    </template>
    <template v-else-if="error">
      <h1>Impossible d'analyser ce lien</h1>
      <p class="alert" role="alert">
        {{ error }}
      </p>
      <p class="muted small shared-text">
        {{ shared }}
      </p>
      <div class="actions">
        <button class="btn btn-primary" @click="lookup(shared, { replace: true })">
          Réessayer
        </button>
        <NuxtLink to="/" class="btn btn-ghost">
          Accueil
        </NuxtLink>
      </div>
    </template>
    <div v-else class="loading-state" aria-live="polite">
      <div class="spinner" />
      <p>Analyse du produit…</p>
    </div>
  </section>
</template>
