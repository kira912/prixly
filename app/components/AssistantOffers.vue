<script setup lang="ts">
import type { Candidate, FinderResult } from '~~/server/lib/finder'

const props = defineProps<{ need: string, answers: string[] }>()
const { t, locale } = useI18n()

const { data, status, error, refresh } = useAsyncData(
  () => `assist-results:${locale.value}:${props.need}:${props.answers.join('|')}`,
  () => $fetch<FinderResult>('/api/assist/results', { method: 'POST', body: { need: props.need, answers: props.answers } }),
  { server: false, lazy: true },
)

const showOthers = ref(false)

function total(c: Candidate): number | null {
  return c.priceCents == null ? null : c.priceCents + (c.shippingCents ?? 0)
}

function shippingLabel(c: Candidate): string {
  if (c.priceCents == null) return t('assistant.results.priceUnknown')
  if (c.shippingCents == null) return t('ebay.item.shippingUnknown')
  if (c.shippingCents === 0) return t('ebay.item.shippingFree')
  return t('ebay.item.shipping', { amount: formatMoney(c.shippingCents, c.currency ?? 'EUR') })
}

const noSources = computed(() => data.value && data.value.sources.ebay === 'off' && data.value.sources.web === 'off')
</script>

<template>
  <section class="assistant-offers" aria-live="polite">
    <h3 class="assistant-h">
      {{ t('assistant.results.title') }}
    </h3>

    <div v-if="status === 'pending'" class="loading-state">
      <div class="spinner" aria-hidden="true" />
      <strong class="small">{{ t('assistant.results.searching') }}</strong>
      <span class="muted small">{{ t('assistant.results.searchingHint') }}</span>
    </div>

    <template v-else-if="error">
      <p class="alert" role="alert">
        {{ errorMessage(error) }}
      </p>
      <button type="button" class="btn btn-ghost" @click="refresh()">
        {{ t('assistant.results.retry') }}
      </button>
    </template>

    <template v-else-if="data">
      <p v-if="noSources" class="muted small">
        {{ t('assistant.results.noSources') }}
      </p>
      <p v-if="data.sources.ebay === 'error'" class="muted small">
        {{ t('assistant.results.ebayError') }}
      </p>
      <p v-if="data.sources.web === 'error'" class="muted small">
        {{ t('assistant.results.webError') }}
      </p>
      <p v-if="data.sources.web === 'quota'" class="muted small">
        {{ t('assistant.results.webQuota') }}
      </p>
      <p v-if="!noSources && !data.picks.length && !data.others.length" class="muted small">
        {{ t('assistant.results.none') }}
      </p>
      <p v-if="!data.picks.length && data.others.length" class="muted small">
        {{ t('assistant.results.unranked') }}
      </p>

      <ul v-if="data.picks.length" class="product-list">
        <li v-for="p in data.picks" :key="p.candidate.id" class="offer-pick">
          <a :href="p.candidate.url" target="_blank" rel="noopener noreferrer" class="product-row">
            <img v-if="p.candidate.image" :src="p.candidate.image" alt="" loading="lazy" referrerpolicy="no-referrer">
            <div v-else class="img-placeholder" />
            <div class="product-row-body">
              <span class="product-row-title" :title="p.candidate.title">{{ p.candidate.title }}</span>
              <span class="muted small">
                <span class="fit-badge" :data-fit="p.fit">{{ t(`assistant.results.fit.${p.fit}`) }}</span>
                {{ p.candidate.shop }}<template v-if="p.candidate.condition"> · {{ p.candidate.condition }}</template><template v-if="p.candidate.auction"> · {{ t('ebay.item.auction') }}</template>
              </span>
              <span class="ai-note small">{{ p.reason }}</span>
              <span v-if="p.warning" class="offer-warning small">⚠ {{ p.warning }}</span>
            </div>
            <div class="product-row-price">
              <strong>{{ total(p.candidate) == null ? '—' : formatMoney(total(p.candidate), p.candidate.currency ?? 'EUR') }}</strong>
              <span class="muted small">{{ shippingLabel(p.candidate) }}</span>
            </div>
          </a>
          <NuxtLink v-if="p.candidate.productId" :to="`/product/${p.candidate.productId}`" class="section-link small offer-prixly">
            {{ t('assistant.results.openInPrixly') }} →
          </NuxtLink>
        </li>
      </ul>

      <template v-if="data.others.length">
        <button v-if="data.picks.length" type="button" class="assistant-toggle small" :aria-expanded="showOthers" @click="showOthers = !showOthers">
          {{ t('assistant.results.others', { n: data.others.length }, data.others.length) }}
        </button>
        <ul v-if="showOthers || !data.picks.length" class="product-list">
          <li v-for="c in data.others" :key="c.id">
            <a :href="c.url" target="_blank" rel="noopener noreferrer" class="product-row">
              <img v-if="c.image" :src="c.image" alt="" loading="lazy" referrerpolicy="no-referrer">
              <div v-else class="img-placeholder" />
              <div class="product-row-body">
                <span class="product-row-title" :title="c.title">{{ c.title }}</span>
                <span class="muted small">{{ c.shop }}<template v-if="c.condition"> · {{ c.condition }}</template></span>
              </div>
              <div class="product-row-price">
                <strong>{{ total(c) == null ? '—' : formatMoney(total(c), c.currency ?? 'EUR') }}</strong>
                <span class="muted small">{{ shippingLabel(c) }}</span>
              </div>
            </a>
          </li>
        </ul>
      </template>
    </template>
  </section>
</template>
