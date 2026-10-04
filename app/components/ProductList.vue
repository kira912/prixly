<script setup lang="ts">
import type { ProductWithStats } from '~~/server/utils/products'

defineProps<{ products: ProductWithStats[] }>()
const { t } = useI18n()
</script>

<template>
  <ul class="product-list">
    <li v-for="p in products" :key="p.id">
      <NuxtLink :to="`/product/${p.id}`" class="product-row">
        <img v-if="p.image" :src="p.image" alt="" loading="lazy" referrerpolicy="no-referrer">
        <div v-else class="img-placeholder" />
        <div class="product-row-body">
          <span class="product-row-title">{{ p.title }}</span>
          <span class="muted small">
            <span class="badge" :data-platform="p.platform">{{ PLATFORM_LABELS[p.platform] }}</span>
            {{ formatRelative(p.fetchedAt) }}
            <template v-if="p.watched && p.lastError"> · {{ t('productList.checkFailed') }}</template>
          </span>
        </div>
        <div class="product-row-price">
          <strong>{{ formatMoney(totalCents(p), p.currency) }}</strong>
          <PriceDelta :stats="p.stats" :currency="p.currency" />
        </div>
      </NuxtLink>
    </li>
  </ul>
</template>
