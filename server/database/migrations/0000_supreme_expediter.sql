CREATE TABLE `price_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`price_cents` integer,
	`shipping_cents` integer,
	`currency` text NOT NULL,
	`captured_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_snapshots_product_id` ON `price_snapshots` (`product_id`,`captured_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`platform` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`image` text,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`price_cents` integer,
	`shipping_cents` integer,
	`shipping_note` text,
	`delivery_min_days` integer,
	`delivery_max_days` integer,
	`delivery_text` text,
	`rating` real,
	`review_count` integer,
	`fetched_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_platform_external_id` ON `products` (`platform`,`external_id`);