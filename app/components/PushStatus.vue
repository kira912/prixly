<script setup lang="ts">
// État des notifications de cet appareil, avec l'action utile selon le cas
const { status, busy, error, enable } = usePush()
</script>

<template>
  <div class="push-status" aria-live="polite">
    <p v-if="status === 'subscribed'" class="small">
      🔔 Alertes activées sur cet appareil. <NuxtLink to="/notifications">Gérer</NuxtLink>
    </p>
    <p v-else-if="status === 'available'" class="small">
      <button class="btn btn-ghost" :disabled="busy" @click="enable">
        🔔 Activer les alertes sur cet appareil
      </button>
    </p>
    <p v-else-if="status === 'denied'" class="small muted">
      🔕 Notifications bloquées pour ce site : autorise-les dans les réglages du navigateur pour recevoir les alertes.
    </p>
    <p v-else-if="status === 'unsupported'" class="small muted">
      🔕 Ce navigateur ne reçoit pas de notifications. Sur iPhone, ajoute Prixly à l'écran d'accueil (Partager → Sur l'écran d'accueil) puis ouvre-le depuis là.
    </p>
    <p v-else-if="status === 'server-disabled'" class="small muted">
      🔕 Notifications non configurées sur le serveur (clés VAPID manquantes).
    </p>
    <p v-if="error" class="alert small" role="alert">
      {{ error }}
    </p>
  </div>
</template>
