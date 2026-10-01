// Dev uniquement : invente un historique de prix pour les produits existants, afin de voir
// le graphique, les variations et le tableau des changements. Le prix actuel réel n'est pas modifié :
// les paliers inventés sont placés AVANT le premier relevé réel de chaque produit.
//
//   pnpm seed:history            ajoute un historique aux produits qui n'en ont pas (≤ 1 palier)
//   pnpm seed:history --force    en ajoute aussi aux autres
//
// Une sauvegarde de la base est faite avant toute écriture (data/prixly.before-seed-<date>.db).
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import Database from 'better-sqlite3'

if (process.env.NODE_ENV === 'production') {
  console.error('Refusé : script réservé au développement.')
  process.exit(1)
}

const dbUrl = process.env.NUXT_DB_URL ?? 'file:./data/prixly.db'
if (!dbUrl.startsWith('file:')) {
  console.error('Refusé : script réservé à une base locale (NUXT_DB_URL=file:…).')
  process.exit(1)
}
const dbPath = resolve(dbUrl.slice('file:'.length))
const force = process.argv.includes('--force')
const db = new Database(dbPath)
db.pragma('foreign_keys = ON')

const backup = resolve(dirname(dbPath), `prixly.before-seed-${new Date().toISOString().replace(/[:.]/g, '-')}.db`)
mkdirSync(dirname(backup), { recursive: true })
await db.backup(backup)
console.log(`Sauvegarde : ${backup}`)

const DAY = 86_400_000
const STEP = 6 * 3_600_000 // un relevé toutes les 6 h

/**
 * Scénarios exprimés relativement au prix actuel : [facteur prix, port ('same' | 'free' | cents), durée en jours].
 * facteur null = produit indisponible pendant la période.
 */
const SCENARIOS = [
  {
    name: 'baisse progressive avec une promo éclair',
    steps: [[1.25, 'same', 12], [1.15, 'same', 9], [1.1, 'same', 6], [1.2, 'same', 5], [0.92, 'same', 2], [1.08, 'same', 7]],
  },
  {
    name: 'port offert puis rupture de stock',
    steps: [[1.3, 'same', 8], [1.18, 'same', 10], [1.22, 'free', 6], [null, null, 2], [1.05, 'same', 9], [1.12, 'same', 4]],
  },
  {
    name: 'hausse régulière (prix plus bas au début)',
    steps: [[0.8, 'same', 10], [0.85, 'same', 8], [0.88, 'same', 7], [0.93, 'same', 9], [0.97, 'same', 6]],
  },
  {
    name: 'prix en dents de scie',
    steps: [[1.1, 'same', 5], [0.95, 'same', 4], [1.12, 'same', 5], [0.9, 'same', 3], [1.05, 'same', 6], [0.98, 'same', 4], [1.06, 'same', 5]],
  },
]

const products = db.prepare('select * from products order by id').all()
const firstSnapshot = db.prepare('select * from price_snapshots where product_id = ? order by captured_at limit 1')
const countSnapshots = db.prepare('select count(*) n from price_snapshots where product_id = ?')
const insert = db.prepare(`insert into price_snapshots (product_id, price_cents, shipping_cents, currency, captured_at, last_seen_at)
  values (?, ?, ?, ?, ?, ?)`)
const allSnapshots = db.prepare('select price_cents, shipping_cents from price_snapshots where product_id = ? order by captured_at')
const updateStats = db.prepare('update products set lowest_cents = ?, highest_cents = ?, previous_cents = ? where id = ?')

const round9 = cents => Math.max(9, Math.round(cents / 10) * 10 - 1) // prix « en ,x9 » crédibles
const total = s => (s.price_cents == null ? null : s.price_cents + (s.shipping_cents ?? 0))

let seeded = 0
db.transaction(() => {
  products.forEach((p, i) => {
    if (!force && countSnapshots.get(p.id).n > 1) {
      console.log(`#${p.id} ignoré (a déjà un historique ; --force pour forcer)`)
      return
    }
    const first = firstSnapshot.get(p.id)
    if (!first || p.price_cents == null) {
      console.log(`#${p.id} ignoré (pas de prix actuel)`)
      return
    }

    const scenario = SCENARIOS[i % SCENARIOS.length]
    const days = scenario.steps.reduce((n, s) => n + s[2], 0)
    let t = first.captured_at - days * DAY
    for (const [factor, shipping, duration] of scenario.steps) {
      const price = factor == null ? null : round9(p.price_cents * factor)
      const ship = factor == null ? null : shipping === 'same' ? p.shipping_cents : shipping === 'free' ? 0 : shipping
      const end = t + duration * DAY - STEP
      insert.run(p.id, price, ship, p.currency, t, end)
      t += duration * DAY
    }

    // Statistiques recalculées sur tout l'historique (mêmes règles que la migration 0003)
    const totals = allSnapshots.all(p.id).map(total)
    const known = totals.filter(v => v != null)
    const current = total(p)
    const previous = [...totals].reverse().find(v => v != null && v !== current) ?? null
    updateStats.run(Math.min(...known), Math.max(...known), previous, p.id)

    seeded++
    console.log(`#${p.id} ${p.title.slice(0, 45)}… → ${scenario.steps.length} paliers sur ${days} j (${scenario.name})`)
  })
})()

console.log(`${seeded} produit(s) enrichi(s).`)
