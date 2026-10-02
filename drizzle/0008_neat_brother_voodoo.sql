CREATE TABLE `agent_memories` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` varchar(64),
	`agentRole` varchar(120) NOT NULL,
	`key` varchar(160) NOT NULL,
	`content` mediumtext NOT NULL,
	`confidence` int NOT NULL DEFAULT 50,
	`sourceRunId` varchar(64),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agent_memories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_runs` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` varchar(64),
	`query` varchar(2000) NOT NULL,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'completed',
	`findings` mediumtext,
	`citations` mediumtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `research_sources` (
	`id` varchar(64) NOT NULL,
	`ownerId` int NOT NULL,
	`projectId` varchar(64),
	`url` varchar(2048) NOT NULL,
	`title` varchar(320),
	`topic` varchar(160) NOT NULL,
	`trustScore` int NOT NULL DEFAULT 50,
	`active` int NOT NULL DEFAULT 1,
	`lastFetchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `research_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `agent_memories` ADD CONSTRAINT `agent_memories_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_runs` ADD CONSTRAINT `research_runs_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `research_sources` ADD CONSTRAINT `research_sources_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `agent_memories_owner_idx` ON `agent_memories` (`ownerId`);--> statement-breakpoint
CREATE INDEX `agent_memories_project_idx` ON `agent_memories` (`projectId`);--> statement-breakpoint
CREATE INDEX `agent_memories_role_idx` ON `agent_memories` (`agentRole`);--> statement-breakpoint
CREATE INDEX `research_runs_owner_idx` ON `research_runs` (`ownerId`);--> statement-breakpoint
CREATE INDEX `research_runs_project_idx` ON `research_runs` (`projectId`);--> statement-breakpoint
CREATE INDEX `research_sources_owner_idx` ON `research_sources` (`ownerId`);--> statement-breakpoint
CREATE INDEX `research_sources_project_idx` ON `research_sources` (`projectId`);