CREATE TABLE `projects` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`type` varchar(80) NOT NULL,
	`description` text NOT NULL,
	`status` enum('Brouillon','En cours','Publié','Archivé') NOT NULL DEFAULT 'En cours',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`files` int NOT NULL DEFAULT 12,
	`accent` varchar(32) NOT NULL DEFAULT '#3B82F6',
	`gradient` varchar(160) NOT NULL DEFAULT 'from-blue-500/30 via-violet-500/10 to-transparent',
	`initials` varchar(8) NOT NULL DEFAULT 'BF',
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `credits` int DEFAULT 428 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `generationCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `projects_owner_idx` ON `projects` (`ownerId`);--> statement-breakpoint
CREATE INDEX `projects_updated_idx` ON `projects` (`updatedAt`);