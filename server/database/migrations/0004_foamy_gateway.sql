CREATE TABLE `product_views` (
	`subscriber_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`viewed_at` integer NOT NULL,
	PRIMARY KEY(`subscriber_id`, `product_id`),
	FOREIGN KEY (`subscriber_id`) REFERENCES `subscribers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_views_recent` ON `product_views` (`subscriber_id`,`viewed_at`);