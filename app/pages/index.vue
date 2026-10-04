<script setup lang="ts">
import type { ProductWithStats } from '~~/server/utils/products'

const { t } = useI18n()
const { loading, error, lookup } = useLookup()
const { data } = await useFetch<{ watched: ProductWithStats[], watchedTotal: number, recent: ProductWithStats[] }>('/api/home', {
  default: () => ({ watched: [], watchedTotal: 0, recent: [] }),
})

function submit(input: string) {
  if (looksLikeLink(input)) return lookup(input)
  return navigateTo({ path: '/search', query: { q: input } })
}

const hasItems = computed(() => data.value.watched.length > 0 || data.value.recent.length > 0)
</script>

<template>
  <section class="hero">
    <h1>{{ t('home.title') }}</h1>
    <p class="lead">
      {{ t('home.lead') }}
    </p>
    <LinkForm :loading="loading" @submit="submit" />
    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
    <p class="platforms small muted">
      {{ t('home.worksWith') }}
      <span class="badge" data-platform="amazon">Amazon</span>
      <span class="badge" data-platform="aliexpress">AliExpress</span>
    </p>
  </section>

  <template v-if="hasItems">
    <section v-if="data.watched.length" class="home-section">
      <div class="section-header">
        <h2>{{ t('home.myWatched') }}</h2>
        <NuxtLink v-if="data.watchedTotal > data.watched.length" to="/watched" class="section-link">
          {{ t('home.seeAll', { n: data.watchedTotal }) }}
        </NuxtLink>
      </div>
      <ProductList :products="data.watched" />
    </section>

    <section v-if="data.recent.length" class="home-section">
      <h2>{{ t('home.recent') }}</h2>
      <ProductList :products="data.recent" />
    </section>

    <details class="home-section how">
      <summary>{{ t('home.howItWorksQuestion') }}</summary>
      <HowItWorks />
    </details>
  </template>

  <section v-else class="home-section">
    <h2>{{ t('home.howItWorks') }}</h2>
    <HowItWorks />
  </section>

  <ClientOnly>
    <InstallCallout class="home-section" />
  </ClientOnly>
</template>
