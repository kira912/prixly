# Prixly

Comparateur de prix entre marketplaces : Amazon, Temu, AliExpress, etc.

Depuis l'appli Amazon ou AliExpress sur Android : **Partager → Prixly**. La PWA reçoit le lien, récupère le produit et affiche le coût total (prix + livraison) et le délai.

## État

- **V1** : partager ou coller un lien Amazon / AliExpress → fiche produit (prix, frais de port, total, délai, note), cache et historique des relevés.
- **Suivi de prix** : « Suivre le prix » sur une fiche → relevé automatique toutes les 6 h, graphique de l'évolution du total, plus bas / plus haut, variation depuis le prix précédent.
- V2 : recherche d'équivalents par image et comparaison des coûts totaux.
- **Alertes de prix** : notification Web Push quand un produit suivi baisse (≥ 5 % ou ≥ 0,50 €), atteint un nouveau plus bas ou passe sous un prix cible.
- V4 : Temu, matching maison.

## Démarrage

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # tests unitaires (extracteurs sur des pages réelles capturées)
pnpm build && node .output/server/index.mjs
```

La base SQLite (client libSQL) est créée dans `data/prixly.db` et les migrations sont appliquées au démarrage.
Variables utiles : `NUXT_DB_URL` (`file:./data/prixly.db` par défaut, ou `libsql://…` pour Turso avec `NUXT_DB_AUTH_TOKEN`), `NUXT_MIGRATIONS_DIR` (lancer le serveur depuis la racine du dépôt, ou pointer vers `server/database/migrations`). Une base distante n'est pas migrée au démarrage : `pnpm db:migrate`.

## Relevés et anti-blocage

- Les requêtes vers Amazon / AliExpress passent par [impit](https://github.com/apify/impit), qui imite l'empreinte TLS/HTTP2 de Chrome (le `fetch` de Node se fait repérer même avec un User-Agent de navigateur). C'est un module natif : builder sur la même plateforme que la prod (attention aux images Alpine/musl ou ARM).
- `PRIXLY_PROXY_URL` (`http://…`, `socks5://user:pass@…`) : fait passer toutes les requêtes par un proxy, résidentiel de préférence.
- Après un captcha, la plateforme est mise en retrait pour les relevés planifiés : 8 h, puis 16 h, 32 h, 48 h max tant que ça bloque ; un relevé réussi remet le compteur à zéro (stocké en base, table `kv`, commun à toutes les instances).
- Le relevé planifié démarre après un délai aléatoire (`PRIXLY_REFRESH_JITTER_MIN`, 20 min par défaut) et alterne les plateformes, avec 3 à 8 s entre deux requêtes.

Après une modification de `server/database/schema.ts` : `pnpm db:generate`.

## Notifications (Web Push)

```bash
pnpm vapid   # génère une paire de clés VAPID
```

Les mettre dans l'environnement du serveur (ou un `.env`, déjà ignoré par git — `node --env-file=.env .output/server/index.mjs` en prod) :

```
NUXT_VAPID_PUBLIC_KEY=…
NUXT_VAPID_PRIVATE_KEY=…
NUXT_VAPID_SUBJECT=mailto:toi@example.com
```

Sans clés, l'appli fonctionne mais les alertes sont désactivées. Changer de clés invalide tous les abonnements existants.

- **Qui suit quoi** : pas de compte. Un cookie anonyme `prixly_sid` (httpOnly, 2 ans) identifie chaque navigateur / appli installée ; les suivis (`watches`), les produits consultés récemment (`product_views`) et les abonnements push lui sont rattachés : chacun ne voit que ses propres produits sur l'accueil. Vider les cookies = repartir de zéro.
- **Quand** : tout relevé (partage, « Actualiser », tâche planifiée) évalue les règles de `server/lib/alerts.ts` pour chaque abonné qui suit le produit : baisse ≥ 5 % ou ≥ 0,50 €, nouveau plus bas historique, ou passage sous le prix cible. Jamais deux alertes pour le même niveau : il faut descendre sous le prix de la dernière alerte, ou que le prix soit d'abord nettement remonté.
- **Où** : le service worker (`app/service-worker/sw.ts`, stratégie `injectManifest`) affiche la notification ; un tap ouvre la fiche. Les abonnements expirés (404/410) sont supprimés à l'envoi.
- **Tester** : page 🔔 → « Envoyer une notification de test ». Le service worker n'existe que sur le build de production (`pnpm build`), pas en `pnpm dev`.
- **Limites** : HTTPS obligatoire (sauf `localhost`) ; sur iOS, seulement si Prixly est ajouté à l'écran d'accueil (iOS 16.4+).

## Suivi de prix

- La tâche Nitro `prices:refresh` (`server/tasks/prices/refresh.ts`) relève les produits suivis par au moins un abonné dont le dernier relevé a plus d'une heure, un par un avec une pause de 3 à 8 s. Si une plateforme renvoie un captcha, ses produits restants sont reportés au passage suivant.
- Planification : `0 */6 * * *` par défaut, modifiable **au build** avec `PRIXLY_REFRESH_CRON`. Valable pour un serveur Node qui tourne en continu ; sur Vercel, voir [Déploiement sur Vercel](#déploiement-sur-vercel).
- Lancer un relevé à la main en dev : `curl -X POST localhost:3000/_nitro/tasks/prices:refresh`.
- `price_snapshots` ne stocke que des **paliers** : un relevé identique au précédent (même prix, même port) repousse `last_seen_at` au lieu d'ajouter une ligne — quelques dizaines de lignes par produit et par an au lieu d'une par relevé.
- Plus bas, plus haut et prix précédent sont **stockés sur la ligne produit** et mis à jour à chaque relevé (`nextStats` dans `server/lib/history.ts`) : la liste des produits lit une ligne par produit, sans toucher à l'historique ; seule la fiche produit lit les paliers de son produit.
- En cas d'échec, l'erreur est affichée sur la fiche et dans la liste.

## Limites anti-abus

Chaque analyse de lien ou actualisation fait scraper **le serveur** : c'est son IP qui se fait bannir. Limites par IP (`server/utils/rate-limit.ts`) :

| Action | Limite |
|---|---|
| Analyser un lien | 10 / min, 100 / jour |
| Actualiser un prix | 5 / min, 50 / jour |
| Suivre / ne plus suivre | 30 / min |
| S'abonner aux notifications | 10 / h |
| Notification de test | 3 / min |

Plus 50 produits suivis maximum par appareil (chaque suivi = un scraping toutes les 6 h). Au-delà : réponse 429 avec `Retry-After`.

- Les compteurs sont stockés en base (table `kv`, purgée des entrées expirées à chaque relevé planifié) : ils tiennent avec plusieurs instances serverless.
- L'IP client n'est lue dans `X-Forwarded-For` que derrière un proxy de confiance : automatique sur Vercel, `NUXT_TRUST_PROXY=true` derrière un ingress. Sinon l'en-tête est ignoré (il permettrait de contourner la limite).

## Déploiement sur Vercel

En serverless, pas de disque persistant ni de process permanent : la base est sur [Turso](https://turso.tech) (libSQL, même SQL et mêmes migrations que le fichier local) et le relevé planifié passe par un endpoint appelé de l'extérieur.

1. **Base Turso**
   ```bash
   turso db create prixly
   turso db show prixly --url        # → NUXT_DB_URL
   turso db tokens create prixly     # → NUXT_DB_AUTH_TOKEN
   ```
   Reprendre les données locales (optionnel) : `turso db create prixly --from-file data/prixly.db`.
   Ou depuis Vercel (Storage → Turso) : l'intégration crée `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`, lues à défaut de `NUXT_DB_URL` / `NUXT_DB_AUTH_TOKEN`.
2. **Projet Vercel** : importer le dépôt (preset Nuxt détecté, réglages dans `vercel.json`). Variables d'environnement :
   `NUXT_DB_URL`, `NUXT_DB_AUTH_TOKEN`, `NUXT_VAPID_PUBLIC_KEY`, `NUXT_VAPID_PRIVATE_KEY`, `NUXT_VAPID_SUBJECT`, `CRON_SECRET` (`openssl rand -hex 32`), et de préférence `PRIXLY_PROXY_URL`. Modèle : `.env.example`.
   Le build lance `pnpm db:migrate` avant `pnpm build` : les migrations sont appliquées à chaque déploiement, preview compris (les previews partagent la base de prod, sauf variables distinctes pour l'environnement Preview).
3. **Relevé planifié** : le cron Vercel du plan Hobby ne tourne qu'une fois par jour, c'est donc GitHub Actions (`.github/workflows/refresh-prices.yml`) qui appelle `GET /api/cron/refresh` toutes les 15 min avec `Authorization: Bearer $CRON_SECRET`. Dans le dépôt GitHub : secret `CRON_SECRET`, variable `PRIXLY_URL` (URL de prod, sans `/` final).
   Chaque appel relève les produits dont le dernier relevé a plus de `PRIXLY_REFRESH_INTERVAL_H` heures (6), les plus anciens d'abord, et s'arrête avant `PRIXLY_REFRESH_BUDGET_SEC` secondes (50) ; le reste passe à l'appel suivant (~8 produits par appel, ~190 par tranche de 6 h). Un verrou en base empêche deux passages simultanés.
   GitHub suspend les workflows planifiés après 60 jours sans activité sur le dépôt.

Limites propres à Vercel :

- **IP de datacenter** : Amazon et AliExpress bloquent bien plus vite les IP AWS de Vercel qu'une IP résidentielle. Sans `PRIXLY_PROXY_URL` (proxy résidentiel), s'attendre à des captchas fréquents.
- `PRIXLY_REFRESH_CRON` et la tâche Nitro `prices:refresh` ne servent pas sur Vercel (désactivées au build).
- `pnpm seed:history` ne fonctionne que sur une base locale.

## Partage depuis Android

Le Web Share Target ne fonctionne que sur Android (Chrome, Edge, Samsung Internet), **une fois la PWA installée**, et en HTTPS. Pour tester depuis le téléphone, exposer le serveur en HTTPS (Tailscale Funnel, cloudflared, ingress du cluster…), ouvrir l'URL dans Chrome puis « Installer l'application ». Prixly apparaît ensuite dans la feuille de partage.

Sur iOS et desktop : coller le lien sur la page d'accueil.

## Fonctionnement

```
texte partagé ─► extractUrl ─► resolveProductRef ─► extracteur ─► SQLite (cache 6 h + relevés de prix)
                              (suit amzn.eu, a.aliexpress.com…
                               uniquement vers des hôtes connus)
```

| Plateforme | Source | Remarques |
|---|---|---|
| Amazon | HTML de la page produit (`cheerio`) | Prix de l'offre « achat ponctuel » (pas l'abonnement), bloc livraison, avis. Captcha possible si trop de requêtes. |
| AliExpress | API interne `mtop.aliexpress.pdp.pc.query` | Le HTML ne contient pas le prix. Requête signée avec le jeton `_m_h5_tk` obtenu en cookie. Localisation fixée à FR / EUR. |

Le code d'extraction est dans `server/lib/` (indépendant de Nuxt, testé avec Vitest) ; les tests s'appuient sur des réponses réelles dans `tests/fixtures/`. Quand une plateforme change sa page, capturer une nouvelle fixture et ajuster le parseur.

## Limites connues

- Scraping : fragile par nature, et contraire aux CGU d'Amazon. Usage personnel uniquement, avec le cache pour limiter les requêtes.
- Amazon : les frais de port affichés sont ceux du bloc de livraison principal (ex. « gratuite lors de votre première commande »), sans tenir compte de ton compte Prime.
- Pas d'authentification : ne pas exposer publiquement sans protection (auth du reverse proxy, Tailscale…).
- AliExpress : c'est le prix de la variante (SKU) sélectionnée par défaut qui est retenu.
