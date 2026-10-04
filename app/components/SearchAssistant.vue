<script setup lang="ts">
import type { AssistAdvice } from '~~/server/lib/assist'

const props = defineProps<{ query: string }>()
const { t } = useI18n()

const { data: features } = useFetch('/api/features', { key: 'features' })

const state = useState<{ need: string, answers: string[], advice: AssistAdvice } | null>('assist', () => null)
const open = ref(false)
const need = ref(state.value?.need ?? '')
const answer = ref('')
const loading = ref(false)
const error = ref('')

async function ask(answers: string[] = []) {
  const text = need.value.trim()
  if (!text) return
  loading.value = true
  error.value = ''
  try {
    const advice = await $fetch<AssistAdvice>('/api/assist', { method: 'POST', body: { need: text, answers } })
    state.value = { need: text, answers, advice }
    answer.value = ''
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

function clarify() {
  if (!state.value || !answer.value.trim()) return
  ask([...state.value.answers, answer.value.trim()])
}

function reset() {
  state.value = null
  need.value = ''
  open.value = true
}

function searchLink(q: string) {
  const c = state.value?.advice.condition
  return { path: '/search', query: { q, condition: c === 'any' ? undefined : c } }
}
</script>

<template>
  <div v-if="features?.assistant" class="assistant">
    <button
      v-if="!state && !open && query"
      type="button"
      class="assistant-toggle small"
      @click="open = true"
    >
      {{ t('assistant.toggle') }}
    </button>

    <form v-else-if="!state" class="assistant-form" @submit.prevent="ask()">
      <label for="need" class="small muted">{{ t('assistant.label') }}</label>
      <textarea
        id="need"
        v-model="need"
        rows="3"
        maxlength="600"
        :placeholder="t('assistant.placeholder')"
      />
      <button type="submit" class="btn btn-primary" :disabled="loading || !need.trim()">
        <span v-if="loading" class="spinner spinner-sm" aria-hidden="true" />
        {{ loading ? t('assistant.thinking') : t('assistant.ask') }}
      </button>
    </form>

    <article v-else class="assistant-card" aria-live="polite">
      <header class="assistant-head">
        <p class="assistant-understood">
          {{ state.advice.understood }}
        </p>
        <button type="button" class="btn btn-ghost" @click="reset">
          {{ t('assistant.newRequest') }}
        </button>
      </header>

      <form v-if="state.advice.question" class="assistant-question" @submit.prevent="clarify">
        <label for="clarify" class="small"><strong>{{ state.advice.question }}</strong></label>
        <div class="search-form">
          <input id="clarify" v-model="answer" type="text" maxlength="300" autocomplete="off" :placeholder="t('assistant.answerPlaceholder')">
          <button type="submit" class="btn btn-ghost" :disabled="loading || !answer.trim()">
            <span v-if="loading" class="spinner spinner-sm" aria-hidden="true" />
            {{ t('assistant.clarify') }}
          </button>
        </div>
      </form>

      <div>
        <h3 class="assistant-h">
          {{ t('assistant.toSearch') }}
        </h3>
        <ul class="assistant-queries">
          <li v-for="s in state.advice.queries" :key="s.query">
            <NuxtLink :to="searchLink(s.query)" class="search-link" :aria-current="s.query === props.query ? 'true' : undefined">
              <span class="search-link-name">{{ s.query }}</span>
              <span class="muted small">{{ s.why }}</span>
              <span class="search-link-arrow" aria-hidden="true">→</span>
            </NuxtLink>
          </li>
        </ul>
      </div>

      <AssistantOffers :need="state.need" :answers="state.answers" />

      <p class="assistant-facts small">
        <span class="chip">{{ t(`assistant.conditions.${state.advice.condition}`) }}</span>
        <span v-if="state.advice.budgetMaxEuros" class="chip">{{ t('assistant.budgetMax', { amount: formatMoney(state.advice.budgetMaxEuros * 100) }) }}</span>
        <span class="muted">{{ state.advice.conditionWhy }}</span>
      </p>

      <div v-if="state.advice.criteria.length">
        <h3 class="assistant-h">
          {{ t('assistant.check') }}
        </h3>
        <ul class="assistant-list">
          <li v-for="c in state.advice.criteria" :key="c">
            {{ c }}
          </li>
        </ul>
      </div>
      <div v-if="state.advice.avoid.length">
        <h3 class="assistant-h">
          {{ t('assistant.avoid') }}
        </h3>
        <ul class="assistant-list assistant-avoid">
          <li v-for="a in state.advice.avoid" :key="a">
            {{ a }}
          </li>
        </ul>
      </div>
    </article>

    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
  </div>
</template>
