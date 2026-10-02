ALTER TABLE `projects`
  ADD `deploymentProvider` enum('vercel','netlify','cloudflare'),
  ADD `deploymentId` varchar(256),
  ADD `deploymentUrl` varchar(2048),
  ADD `deploymentStatus` enum('queued','building','ready','error'),
  ADD `deploymentError` text,
  ADD `deployedRevision` int,
  ADD `deploymentUpdatedAt` timestamp;
