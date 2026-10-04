<script setup lang="ts">
export interface ChartPoint {
  at: string | Date
  until: string | Date
  totalCents: number | null
}

const props = defineProps<{
  points: ChartPoint[]
  currency: string
  end?: string | Date | null
}>()

const { t: translate } = useI18n()

const HEIGHT = 200
const PAD = { top: 16, right: 16, bottom: 28, left: 56 }

const container = ref<HTMLElement>()
const width = ref(600)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(260, Math.round(entry.contentRect.width))
  })
  if (container.value) observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const t = (d: string | Date) => new Date(d).getTime()

const domain = computed(() => {
  const start = t(props.points[0]!.at)
  const lastUntil = t(props.points.at(-1)!.until)
  const end = Math.max(lastUntil, props.end ? t(props.end) : 0, start + 3_600_000)
  const totals = props.points.map(p => p.totalCents).filter((v): v is number => v != null)
  const min = Math.min(...totals)
  const max = Math.max(...totals)
  const span = max === min ? Math.max(min * 0.2, 100) : max - min
  const raw = span / 2
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = ([1, 2, 5, 10].find(m => m * mag >= raw) ?? 10) * mag
  let lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  if (lo === min && lo > 0) lo -= step
  if (hi === max) hi += step
  lo = Math.max(0, lo)
  return { start, end, lo, hi, step }
})

const plotW = computed(() => width.value - PAD.left - PAD.right)
const plotH = HEIGHT - PAD.top - PAD.bottom
const x = (ms: number) => PAD.left + ((ms - domain.value.start) / (domain.value.end - domain.value.start)) * plotW.value
const y = (cents: number) => PAD.top + (1 - (cents - domain.value.lo) / (domain.value.hi - domain.value.lo)) * plotH

const steps = computed(() => props.points.map((p, i) => {
  const next = props.points[i + 1]
  const x0 = x(t(p.at))
  const x1 = next ? x(t(next.at)) : x(domain.value.end)
  return { ...p, x0, x1, y: p.totalCents == null ? null : y(p.totalCents) }
}))

const path = computed(() => {
  let d = ''
  let prev: { x1: number, y: number | null } | null = null
  for (const s of steps.value) {
    if (s.y == null) {
      prev = null
      continue
    }
    d += prev?.y != null ? ` V${s.y.toFixed(1)}` : ` M${s.x0.toFixed(1)},${s.y.toFixed(1)}`
    d += ` H${s.x1.toFixed(1)}`
    prev = s
  }
  return d.trim()
})

const ticks = computed(() => {
  const { lo, hi, step } = domain.value
  const out: number[] = []
  for (let v = lo; v <= hi + 1e-6; v += step) out.push(Math.round(v))
  return out
})

const money = (c: number | null) => formatMoney(c, props.currency)
const shortDate = (d: string | Date | number) => new Date(d).toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short' })
const longDate = (d: string | Date | number) => formatDate(d, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const active = ref<number | null>(null)
function onPointer(e: PointerEvent) {
  const rect = (e.currentTarget as SVGElement).getBoundingClientRect()
  const px = e.clientX - rect.left
  const i = steps.value.findIndex(s => px >= s.x0 && px < s.x1)
  active.value = i === -1 ? (px < PAD.left ? 0 : steps.value.length - 1) : i
}
function onKey(e: KeyboardEvent) {
  const n = steps.value.length
  if (e.key === 'ArrowRight') active.value = Math.min(n - 1, (active.value ?? -1) + 1)
  else if (e.key === 'ArrowLeft') active.value = Math.max(0, (active.value ?? n) - 1)
  else return
  e.preventDefault()
}
const activeStep = computed(() => (active.value == null ? null : steps.value[active.value]))
const last = computed(() => steps.value.at(-1)!)
</script>

<template>
  <figure ref="container" class="chart">
    <svg
      :height="HEIGHT"
      :viewBox="`0 0 ${width} ${HEIGHT}`"
      role="img"
      :aria-label="translate('chart.label', { from: money(points[0]!.totalCents), to: money(last.totalCents) })"
      tabindex="0"
      @pointermove="onPointer"
      @pointerleave="active = null"
      @focus="active = steps.length - 1"
      @blur="active = null"
      @keydown="onKey"
    >
      <g class="chart-grid">
        <template v-for="v in ticks" :key="v">
          <line :x1="PAD.left" :x2="width - PAD.right" :y1="y(v)" :y2="y(v)" />
          <text :x="PAD.left - 8" :y="y(v)" text-anchor="end" dominant-baseline="middle">{{ money(v) }}</text>
        </template>
        <text :x="PAD.left" :y="HEIGHT - 8">{{ shortDate(domain.start) }}</text>
        <text :x="width - PAD.right" :y="HEIGHT - 8" text-anchor="end">{{ shortDate(domain.end) }}</text>
      </g>

      <path class="chart-line" :d="path" />

      <template v-for="(s, i) in steps" :key="i">
        <circle v-if="s.y != null" class="chart-dot" :cx="s.x0" :cy="s.y" r="4" />
      </template>

      <g v-if="activeStep" class="chart-cursor">
        <line :x1="Math.max(PAD.left, Math.min(activeStep.x0, width - PAD.right))" :x2="Math.max(PAD.left, Math.min(activeStep.x0, width - PAD.right))" :y1="PAD.top" :y2="HEIGHT - PAD.bottom" />
        <circle v-if="activeStep.y != null" class="chart-dot chart-dot-active" :cx="activeStep.x0" :cy="activeStep.y" r="5" />
      </g>
    </svg>

    <div
      v-if="activeStep"
      class="chart-tooltip"
      :style="{ left: `${Math.min(Math.max(activeStep.x0, 90), width - 90)}px` }"
    >
      <strong>{{ activeStep.totalCents == null ? translate('common.unavailable') : money(activeStep.totalCents) }}</strong>
      <span>{{ longDate(activeStep.at) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.chart { position: relative; margin: 0; width: 100%; min-width: 0; }
svg { display: block; width: 100%; overflow: visible; touch-action: pan-y; }
svg:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.chart-grid line { stroke: var(--border); stroke-width: 1; }
.chart-grid text { fill: var(--muted); font-size: 11px; font-variant-numeric: tabular-nums; }
.chart-line { fill: none; stroke: var(--chart-line); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
.chart-dot { fill: var(--chart-line); stroke: var(--surface); stroke-width: 2; }
.chart-cursor line { stroke: var(--muted); stroke-width: 1; stroke-dasharray: 3 3; }
.chart-tooltip {
  position: absolute;
  top: -8px;
  transform: translate(-50%, -100%);
  display: grid;
  gap: 2px;
  padding: .4rem .6rem;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgb(0 0 0 / .12);
  font-size: .8rem;
  white-space: nowrap;
  pointer-events: none;
}
.chart-tooltip strong { font-size: .95rem; color: var(--text); }
.chart-tooltip span { color: var(--muted); }
</style>
