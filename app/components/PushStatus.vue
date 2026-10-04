<script setup lang="ts">
const { t } = useI18n()
const { status, busy, error, enable } = usePush()
</script>

<template>
  <div class="push-status" aria-live="polite">
    <p v-if="status === 'subscribed'" class="small">
      {{ t('push.enabled') }} <NuxtLink to="/notifications">{{ t('push.manage') }}</NuxtLink>
    </p>
    <p v-else-if="status === 'available'" class="small">
      <button class="btn btn-ghost" :disabled="busy" @click="enable">
        {{ t('push.enable') }}
      </button>
    </p>
    <p v-else-if="status === 'denied'" class="small muted">
      {{ t('push.denied') }}
    </p>
    <p v-else-if="status === 'unsupported'" class="small muted">
      {{ t('push.unsupported') }}
    </p>
    <p v-else-if="status === 'server-disabled'" class="small muted">
      {{ t('push.serverDisabled') }}
    </p>
    <p v-if="error" class="alert small" role="alert">
      {{ error }}
    </p>
  </div>
</template>
