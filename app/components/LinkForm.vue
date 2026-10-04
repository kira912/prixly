<script setup lang="ts">
const emit = defineEmits<{ submit: [input: string] }>()
defineProps<{ loading?: boolean }>()

const { t } = useI18n()
const input = ref('')

async function pasteFromClipboard() {
  try {
    input.value = await navigator.clipboard.readText()
  }
  catch {
  }
}

function onSubmit() {
  if (input.value.trim()) emit('submit', input.value.trim())
}
</script>

<template>
  <form class="link-form" @submit.prevent="onSubmit">
    <label for="link" class="sr-only">{{ t('linkForm.label') }}</label>
    <textarea
      id="link"
      v-model="input"
      rows="2"
      :placeholder="t('linkForm.placeholder')"
      autocomplete="off"
      :disabled="loading"
      @keydown.enter.exact.prevent="onSubmit"
    />
    <div class="link-form-actions">
      <button type="button" class="btn btn-ghost" :disabled="loading" @click="pasteFromClipboard">
        {{ t('linkForm.paste') }}
      </button>
      <button type="submit" class="btn btn-primary" :disabled="loading || !input.trim()">
        {{ loading ? t('linkForm.analyzing') : t('linkForm.submit') }}
      </button>
    </div>
  </form>
</template>
