<script setup lang="ts">
import type { ProductWithStats } from '~~/server/utils/products'

const { data: products } = await useFetch<ProductWithStats[]>('/api/watched', { default: () => [] })

useHead({ title: 'Mes suivis · Prixly' })
</script>

<template>
  <section class="hero">
    <h1>Mes suivis</h1>
    <p class="muted">
      Prix relevés toutes les 6 h. Tu reçois une notification quand l'un d'eux baisse.
      <NuxtLink to="/notifications" class="section-link">
        Réglages des alertes
      </NuxtLink>
    </p>
  </section>

  <ProductList v-if="products.length" :products="products" class="home-section" />
  <p v-else class="home-section muted">
    Tu ne suis encore aucun produit. Ouvre une fiche produit et touche <strong>Suivre le prix</strong>.
  </p>
</template>
