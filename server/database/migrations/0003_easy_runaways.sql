ALTER TABLE `price_snapshots` ADD `last_seen_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `lowest_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `highest_cents` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `previous_cents` integer;--> statement-breakpoint
-- Reprise des données : fusion des relevés consécutifs identiques (même prix, même port) en un palier
UPDATE `price_snapshots` SET `last_seen_at` = `captured_at`;--> statement-breakpoint
CREATE TEMP TABLE `snapshot_runs` AS
WITH marked AS (
  SELECT id, product_id, captured_at,
    CASE WHEN price_cents IS LAG(price_cents) OVER w AND shipping_cents IS LAG(shipping_cents) OVER w THEN 0 ELSE 1 END AS is_start
  FROM price_snapshots
  WINDOW w AS (PARTITION BY product_id ORDER BY captured_at, id)
), grouped AS (
  SELECT id, product_id, captured_at,
    SUM(is_start) OVER (PARTITION BY product_id ORDER BY captured_at, id ROWS UNBOUNDED PRECEDING) AS grp
  FROM marked
)
SELECT
  id,
  FIRST_VALUE(id) OVER (PARTITION BY product_id, grp ORDER BY captured_at, id) AS first_id,
  MAX(captured_at) OVER (PARTITION BY product_id, grp) AS last_at
FROM grouped;--> statement-breakpoint
UPDATE `price_snapshots`
SET `last_seen_at` = (SELECT r.last_at FROM snapshot_runs r WHERE r.id = price_snapshots.id)
WHERE `id` IN (SELECT first_id FROM snapshot_runs);--> statement-breakpoint
DELETE FROM `price_snapshots` WHERE `id` NOT IN (SELECT first_id FROM snapshot_runs);--> statement-breakpoint
DROP TABLE `snapshot_runs`;--> statement-breakpoint
-- Statistiques initiales ; previous = dernier total non nul différent du total actuel
UPDATE `products` SET
  `lowest_cents` = (SELECT MIN(s.price_cents + COALESCE(s.shipping_cents, 0)) FROM price_snapshots s WHERE s.product_id = products.id AND s.price_cents IS NOT NULL),
  `highest_cents` = (SELECT MAX(s.price_cents + COALESCE(s.shipping_cents, 0)) FROM price_snapshots s WHERE s.product_id = products.id AND s.price_cents IS NOT NULL),
  `previous_cents` = (
    SELECT s.price_cents + COALESCE(s.shipping_cents, 0) FROM price_snapshots s
    WHERE s.product_id = products.id AND s.price_cents IS NOT NULL
      AND (products.price_cents IS NULL OR s.price_cents + COALESCE(s.shipping_cents, 0) <> products.price_cents + COALESCE(products.shipping_cents, 0))
    ORDER BY s.captured_at DESC LIMIT 1
  );
