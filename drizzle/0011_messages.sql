CREATE TABLE `messages` (
  `id` varchar(64) NOT NULL,
  `ownerId` int NOT NULL,
  `projectId` varchar(64) NOT NULL,
  `role` varchar(16) NOT NULL,
  `content` mediumtext NOT NULL,
  `actions` json DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `messages_pk` PRIMARY KEY (`id`),
  CONSTRAINT `messages_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`),
  CONSTRAINT `messages_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `messages_owner_idx` ON `messages` (`ownerId`);
--> statement-breakpoint
CREATE INDEX `messages_project_idx` ON `messages` (`projectId`);
--> statement-breakpoint
CREATE INDEX `messages_created_idx` ON `messages` (`createdAt`);
