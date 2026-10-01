<script setup lang="ts">
const emit = defineEmits<{ submit: [input: string] }>()
defineProps<{ loading?: boolean }>()

const input = ref('')

async function pasteFromClipboard() {
  try {
    input.value = await navigator.clipboard.readText()
  }
  catch {
    // Permission refusée : l'utilisateur collera à la main
  }
}

function onSubmit() {
  if (input.value.trim()) emit('submit', input.value.trim())
}
</script>

<template>
  <form class="link-form" @submit.prevent="onSubmit">
    <label for="link" class="sr-only">Lien du produit</label>
    <textarea
      id="link"
      v-model="input"
      rows="2"
      placeholder="Colle un lien Amazon ou AliExpress…"
      autocomplete="off"
      :disabled="loading"
      @keydown.enter.exact.prevent="onSubmit"
    />
    <div class="link-form-actions">
      <button type="button" class="btn btn-ghost" :disabled="loading" @click="pasteFromClipboard">
        Coller
      </button>
      <button type="submit" class="btn btn-primary" :disabled="loading || !input.trim()">
        {{ loading ? 'Analyse…' : 'Analyser' }}
      </button>
    </div>
  </form>
</template>
