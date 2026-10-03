CREATE TABLE `marketplace_offers` (
	`product_id` integer NOT NULL,
	`marketplace` text NOT NULL,
	`url` text NOT NULL,
	`status` text NOT NULL,
	`price_cents` integer,
	`currency` text,
	`error` text,
	`fetched_at` integer NOT NULL,
	PRIMARY KEY(`product_id`, `marketplace`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
