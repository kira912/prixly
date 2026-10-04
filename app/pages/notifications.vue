<script setup lang="ts">
const { t } = useI18n()
const { status, busy, disable, sendTest } = usePush()
const tested = ref(false)

async function test() {
  tested.value = false
  await sendTest()
  tested.value = true
}

useHead(() => ({ title: `${t('notifications.title')} · Prixly` }))
</script>

<template>
  <section class="hero">
    <h1>{{ t('notifications.title') }}</h1>
    <p class="muted">
      {{ t('notifications.intro') }}
    </p>

    <ClientOnly>
      <PushStatus />
      <div v-if="status === 'subscribed'" class="actions">
        <button class="btn btn-primary" :disabled="busy" @click="test">
          {{ t('notifications.sendTest') }}
        </button>
        <button class="btn btn-ghost" :disabled="busy" @click="disable">
          {{ t('notifications.disable') }}
        </button>
      </div>
      <p v-if="tested && status === 'subscribed'" class="muted small">
        {{ t('notifications.sent') }}
      </p>
      <template #fallback>
        <p class="muted small">
          {{ t('common.loading') }}
        </p>
      </template>
    </ClientOnly>
  </section>
</template>
