<script setup lang="ts">
import type { ProductWithStats } from '~~/server/utils/products'

const { loading, error, lookup } = useLookup()
const { data } = await useFetch<{ watched: ProductWithStats[], watchedTotal: number, recent: ProductWithStats[] }>('/api/home', {
  default: () => ({ watched: [], watchedTotal: 0, recent: [] }),
})

const hasItems = computed(() => data.value.watched.length > 0 || data.value.recent.length > 0)
</script>

<template>
  <section class="hero">
    <h1>Le vrai prix, avant d'acheter.</h1>
    <p class="lead">
      Prixly calcule ce que te coûte vraiment un produit Amazon ou AliExpress
      (prix, frais de port et délai de livraison) et te prévient quand il baisse.
    </p>
    <LinkForm :loading="loading" @submit="lookup" />
    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
    <p class="platforms small muted">
      Fonctionne avec
      <span class="badge" data-platform="amazon">Amazon</span>
      <span class="badge" data-platform="aliexpress">AliExpress</span>
    </p>
  </section>

  <template v-if="hasItems">
    <section v-if="data.watched.length" class="home-section">
      <div class="section-header">
        <h2>Mes suivis</h2>
        <NuxtLink v-if="data.watchedTotal > data.watched.length" to="/suivis" class="section-link">
          Tout voir ({{ data.watchedTotal }})
        </NuxtLink>
      </div>
      <ProductList :products="data.watched" />
    </section>

    <section v-if="data.recent.length" class="home-section">
      <h2>Consultés récemment</h2>
      <ProductList :products="data.recent" />
    </section>

    <details class="home-section how">
      <summary>Comment ça marche ?</summary>
      <HowItWorks />
    </details>
  </template>

  <section v-else class="home-section">
    <h2>Comment ça marche</h2>
    <HowItWorks />
  </section>

  <ClientOnly>
    <InstallCallout class="home-section" />
  </ClientOnly>
</template>
