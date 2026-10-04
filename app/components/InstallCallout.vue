<script setup lang="ts">
const { t } = useI18n()
const { standalone, platform, canPrompt, install } = useInstall()
</script>

<template>
  <aside v-if="!standalone" class="callout">
    <template v-if="platform === 'android'">
      <h2>{{ t('install.androidTitle') }}</h2>
      <i18n-t keypath="install.androidText" tag="p" scope="global">
        <template #share>
          <strong>{{ t('install.share') }}</strong>
        </template>
      </i18n-t>
      <button v-if="canPrompt" class="btn btn-primary" @click="install">
        {{ t('install.installButton') }}
      </button>
      <i18n-t v-else keypath="install.chromeHint" tag="p" class="muted small" scope="global">
        <template #action>
          <strong>{{ t('install.chromeAction') }}</strong>
        </template>
      </i18n-t>
    </template>

    <template v-else-if="platform === 'ios'">
      <h2>{{ t('install.iosTitle') }}</h2>
      <i18n-t keypath="install.iosText" tag="p" scope="global">
        <template #action>
          <strong>{{ t('install.iosAction') }}</strong>
        </template>
      </i18n-t>
    </template>

    <template v-else>
      <h2>{{ t('install.desktopTitle') }}</h2>
      <i18n-t keypath="install.desktopText" tag="p" scope="global">
        <template #share>
          <strong>{{ t('install.share') }}</strong>
        </template>
      </i18n-t>
      <button v-if="canPrompt" class="btn btn-ghost" @click="install">
        {{ t('install.installDesktop') }}
      </button>
    </template>
  </aside>
</template>
