<script setup lang="ts">
// Explique comment obtenir Prixly dans la feuille de partage, selon l'appareil ; masqué une fois l'appli installée
const { standalone, platform, canPrompt, install } = useInstall()
</script>

<template>
  <aside v-if="!standalone" class="callout">
    <template v-if="platform === 'android'">
      <h2>Partage directement depuis Amazon</h2>
      <p>
        Installe Prixly : il apparaîtra dans le menu <strong>Partager</strong> des applis Amazon et AliExpress.
      </p>
      <button v-if="canPrompt" class="btn btn-primary" @click="install">
        Installer Prixly
      </button>
      <p v-else class="muted small">
        Dans Chrome : menu ⋮ → <strong>Installer l'application</strong> (pas « Ajouter à l'écran d'accueil »).
      </p>
    </template>

    <template v-else-if="platform === 'ios'">
      <h2>Sur iPhone</h2>
      <p>
        iOS ne permet pas le partage vers une appli web : copie le lien du produit et colle-le ici.
        Pour recevoir les alertes de prix, ajoute Prixly à l'écran d'accueil (Partager → <strong>Sur l'écran d'accueil</strong>).
      </p>
    </template>

    <template v-else>
      <h2>Sur ton téléphone Android</h2>
      <p>
        Ouvre Prixly dans Chrome et installe-le : il apparaîtra dans le menu <strong>Partager</strong> des applis Amazon et AliExpress.
        Sur ordinateur, colle simplement le lien.
      </p>
      <button v-if="canPrompt" class="btn btn-ghost" @click="install">
        Installer sur cet ordinateur
      </button>
    </template>
  </aside>
</template>
