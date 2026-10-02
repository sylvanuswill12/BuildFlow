CREATE TABLE `payments` (
	`id` varchar(128) NOT NULL,
	`ownerId` int NOT NULL,
	`plan` enum('pro','team') NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(8) NOT NULL,
	`status` varchar(32) NOT NULL,
	`stripeCheckoutSessionId` varchar(128),
	`stripePaymentIntentId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripeCheckoutSessionId_unique` UNIQUE(`stripeCheckoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `stripe_events` (
	`id` varchar(128) NOT NULL,
	`type` varchar(128) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripe_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `credits` int NOT NULL DEFAULT 20;--> statement-breakpoint
ALTER TABLE `users` ADD `plan` enum('free','pro','team') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `stripePriceId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCurrentPeriodEnd` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_stripeSubscriptionId_unique` UNIQUE(`stripeSubscriptionId`);--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `payments_owner_idx` ON `payments` (`ownerId`);--> statement-breakpoint
CREATE INDEX `payments_created_idx` ON `payments` (`createdAt`);