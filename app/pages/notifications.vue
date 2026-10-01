<script setup lang="ts">
const { status, busy, disable, sendTest } = usePush()
const tested = ref(false)

async function test() {
  tested.value = false
  await sendTest()
  tested.value = true
}

useHead({ title: 'Notifications · Prixly' })
</script>

<template>
  <section class="hero">
    <h1>Notifications</h1>
    <p class="muted">
      Pour chaque produit suivi, Prixly t'envoie une notification quand le total (prix + port) baisse
      d'au moins 5 % ou 0,50 €, atteint un nouveau plus bas, ou passe sous ton prix cible.
    </p>

    <ClientOnly>
      <PushStatus />
      <div v-if="status === 'subscribed'" class="actions">
        <button class="btn btn-primary" :disabled="busy" @click="test">
          Envoyer une notification de test
        </button>
        <button class="btn btn-ghost" :disabled="busy" @click="disable">
          Désactiver sur cet appareil
        </button>
      </div>
      <p v-if="tested && status === 'subscribed'" class="muted small">
        Envoyée. Rien reçu ? Vérifie que les notifications de Chrome ne sont pas en mode silencieux dans les réglages Android.
      </p>
      <template #fallback>
        <p class="muted small">
          Chargement…
        </p>
      </template>
    </ClientOnly>
  </section>
</template>
