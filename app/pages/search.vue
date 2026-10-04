<script setup lang="ts">
import { searchLinks, type SearchKind } from '~/utils/search'

const { t, te } = useI18n()
const route = useRoute()
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const input = ref(query.value)
watch(query, (q) => { input.value = q })

const KINDS: SearchKind[] = ['new', 'used']
const groups = computed(() => KINDS.map(kind => ({ kind, links: searchLinks(query.value, kind) })))

const RECENT_KEY = 'prixly:recent-searches'
const recent = ref<string[]>([])
onMounted(() => {
  try {
    recent.value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  }
  catch {}
  remember(query.value)
})
watch(query, remember)
function remember(q: string) {
  if (!q) return
  recent.value = [q, ...recent.value.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, 6)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  }
  catch {}
}

function submit() {
  const q = input.value.trim()
  if (!q) return
  if (looksLikeLink(q)) return navigateTo({ path: '/share', query: { text: q } })
  navigateTo({ query: { q } })
}

useHead(() => ({ title: query.value ? `${query.value} · ${t('search.pageTitle')} · Prixly` : `${t('search.pageTitle')} · Prixly` }))
</script>

<template>
  <section class="hero">
    <h1>{{ t('search.title') }}</h1>
    <p class="lead">
      {{ t('search.lead') }}
    </p>
    <form class="search-form" role="search" @submit.prevent="submit">
      <label for="q" class="sr-only">{{ t('search.label') }}</label>
      <input
        id="q"
        v-model="input"
        type="search"
        enterkeyhint="search"
        :placeholder="t('search.placeholder')"
        autocomplete="off"
      >
      <button type="submit" class="btn btn-primary" :disabled="!input.trim()">
        {{ t('search.submit') }}
      </button>
    </form>
    <ClientOnly>
      <p v-if="!query && recent.length" class="recent-searches small">
        <span class="muted">{{ t('search.recent') }}</span>
        <NuxtLink v-for="r in recent" :key="r" :to="{ query: { q: r } }" class="chip">
          {{ r }}
        </NuxtLink>
      </p>
    </ClientOnly>
    <SearchAssistant :query="query" />
  </section>

  <template v-if="query">
    <EbayResults :query="query" />

    <section v-for="g in groups" :key="g.kind" class="home-section">
      <h2>{{ t('search.elsewhere', { kind: t(`search.kinds.${g.kind}`) }) }}</h2>
      <ul class="search-links">
        <li v-for="l in g.links" :key="l.id">
          <a :href="l.href" target="_blank" rel="noopener noreferrer" class="search-link">
            <span class="search-link-name">{{ l.name }}</span>
            <span v-if="te(`search.hints.${l.id}`)" class="muted small">{{ t(`search.hints.${l.id}`) }}</span>
            <span v-if="l.supported" class="supported-tag small">{{ t('search.tracked') }}</span>
            <span class="search-link-arrow" aria-hidden="true">↗</span>
          </a>
        </li>
      </ul>
    </section>

    <aside class="callout home-section">
      <h2>{{ t('search.foundTitle') }}</h2>
      <p class="muted small">
        {{ t('search.foundText') }}
      </p>
    </aside>
  </template>
</template>
