CREATE TABLE `snapshots` (
  `id` varchar(64) NOT NULL,
  `ownerId` int NOT NULL,
  `projectId` varchar(64) NOT NULL,
  `label` varchar(320) NOT NULL,
  `files` mediumtext NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `snapshots_owner_idx` (`ownerId`),
  KEY `snapshots_project_idx` (`projectId`),
  KEY `snapshots_created_idx` (`createdAt`),
  CONSTRAINT `snapshots_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`),
  CONSTRAINT `snapshots_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
);
