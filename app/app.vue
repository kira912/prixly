<template>
  <NuxtPwaManifest />
  <header class="topbar">
    <NuxtLink to="/" class="brand">
      <img src="/icon.svg" alt="" width="28" height="28">
      <span>Prixly</span>
    </NuxtLink>
    <nav class="topbar-actions" aria-label="Navigation principale">
      <NuxtLink to="/suivis" class="btn btn-ghost">
        Suivis
      </NuxtLink>
      <NuxtLink to="/notifications" class="btn btn-ghost btn-icon" aria-label="Notifications" title="Notifications">
        🔔
      </NuxtLink>
    </nav>
  </header>
  <main class="container">
    <NuxtPage />
  </main>
</template>
