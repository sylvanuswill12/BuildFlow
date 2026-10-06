CREATE TABLE `attachments` (
  `id` varchar(64) NOT NULL,
  `ownerId` int NOT NULL,
  `projectId` varchar(64) NOT NULL,
  `storageKey` varchar(96) NOT NULL,
  `originalName` varchar(240) NOT NULL,
  `mimeType` varchar(32) NOT NULL,
  `size` int NOT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `attachments_storageKey_unique` (`storageKey`),
  KEY `attachments_owner_idx` (`ownerId`),
  KEY `attachments_project_idx` (`projectId`),
  KEY `attachments_created_idx` (`createdAt`),
  CONSTRAINT `attachments_owner_fk` FOREIGN KEY (`ownerId`) REFERENCES `users` (`id`),
  CONSTRAINT `attachments_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects` (`id`) ON DELETE CASCADE
);
