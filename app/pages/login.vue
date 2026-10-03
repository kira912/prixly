<script setup lang="ts">
// Page de connexion par code d'accès (NUXT_ACCESS_CODE) ; le middleware serveur y renvoie toute visite sans cookie
const route = useRoute()
const code = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

// Retour vers la page demandée (ex. /share?url=… après un partage), jamais vers un autre site
const next = computed(() => {
  const n = route.query.next
  return typeof n === 'string' && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/'
})

async function submit() {
  loading.value = true
  error.value = null
  try {
    await $fetch('/api/login', { method: 'POST', body: { code: code.value } })
    await navigateTo(next.value, { replace: true })
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

useHead({ title: 'Connexion · Prixly' })
</script>

<template>
  <section class="hero login">
    <h1>Accès privé</h1>
    <p class="muted">
      Saisis le code d'accès pour utiliser Prixly sur cet appareil.
    </p>
    <form class="login-form" @submit.prevent="submit">
      <label for="code">Code d'accès</label>
      <input
        id="code"
        v-model="code"
        type="password"
        autocomplete="current-password"
        required
        :aria-invalid="!!error"
        :disabled="loading"
      >
      <button type="submit" class="btn btn-primary" :disabled="loading || !code.trim()">
        {{ loading ? 'Vérification…' : 'Entrer' }}
      </button>
    </form>
    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
  </section>
</template>
