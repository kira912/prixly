<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const code = ref('')
const loading = ref(false)
const error = ref<string | null>(null)

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

useHead(() => ({ title: `${t('login.pageTitle')} · Prixly` }))
</script>

<template>
  <section class="hero login">
    <h1>{{ t('login.title') }}</h1>
    <p class="muted">
      {{ t('login.text') }}
    </p>
    <form class="login-form" @submit.prevent="submit">
      <label for="code">{{ t('login.label') }}</label>
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
        {{ loading ? t('login.checking') : t('login.submit') }}
      </button>
    </form>
    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
  </section>
</template>
