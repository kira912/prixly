CREATE TABLE `push_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscriber_id` integer NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE INDEX `push_subscriptions_subscriber_id` ON `push_subscriptions` (`subscriber_id`);--> statement-breakpoint
CREATE TABLE `subscribers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subscribers_token_hash_unique` ON `subscribers` (`token_hash`);--> statement-breakpoint
CREATE TABLE `watches` (
	`subscriber_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`target_price_cents` integer,
	`last_notified_cents` integer,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`subscriber_id`, `product_id`),
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `watches_product_id` ON `watches` (`product_id`);--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `tracked_at`;