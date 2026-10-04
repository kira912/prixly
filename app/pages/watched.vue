<script setup lang="ts">
import type { ProductWithStats } from '~~/server/utils/products'

const { t } = useI18n()
const { data: products } = await useFetch<ProductWithStats[]>('/api/watched', { default: () => [] })

useHead(() => ({ title: `${t('watched.title')} · Prixly` }))
</script>

<template>
  <section class="hero">
    <h1>{{ t('watched.title') }}</h1>
    <p class="muted">
      {{ t('watched.intro') }}
      <NuxtLink to="/notifications" class="section-link">
        {{ t('watched.alertSettings') }}
      </NuxtLink>
    </p>
  </section>

  <ProductList v-if="products.length" :products="products" class="home-section" />
  <i18n-t v-else keypath="watched.empty" tag="p" class="home-section muted" scope="global">
    <template #action>
      <strong>{{ t('watched.emptyAction') }}</strong>
    </template>
  </i18n-t>
</template>
