ALTER TABLE `products` ADD `tracked_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `last_checked_at` integer;--> statement-breakpoint
ALTER TABLE `products` ADD `last_error` text;