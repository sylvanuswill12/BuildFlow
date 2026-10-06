ALTER TABLE `users`
  MODIFY `openId` varchar(64) NULL,
  ADD `authId` varchar(64) NULL,
  ADD `passwordHash` varchar(255) NULL,
  ADD CONSTRAINT `users_authId_unique` UNIQUE (`authId`),
  ADD CONSTRAINT `users_email_unique` UNIQUE (`email`);
