CREATE TABLE `openclaw_cron_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openclawJobId` varchar(64),
	`name` varchar(128) NOT NULL,
	`description` text,
	`schedule` varchar(64) NOT NULL,
	`command` text NOT NULL,
	`enabled` boolean DEFAULT true,
	`lastRun` timestamp,
	`lastStatus` enum('success','failed','skipped'),
	`lastError` text,
	`nextRun` timestamp,
	`runCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `openclaw_cron_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `openclaw_cron_jobs_openclawJobId_unique` UNIQUE(`openclawJobId`)
);
--> statement-breakpoint
CREATE TABLE `openclaw_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`channel` varchar(32) NOT NULL,
	`type` varchar(64) NOT NULL,
	`target` varchar(128),
	`message` text,
	`payload` json,
	`status` enum('pending','sent','failed','delivered') DEFAULT 'pending',
	`errorMessage` text,
	`sentAt` timestamp,
	`deliveredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `openclaw_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `openclaw_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`enabled` boolean DEFAULT true,
	`channels` json,
	`quietHoursEnabled` boolean DEFAULT false,
	`quietHoursStart` varchar(5),
	`quietHoursEnd` varchar(5),
	`quietHoursTimezone` varchar(64) DEFAULT 'Europe/Moscow',
	`preferences` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `openclaw_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `openclaw_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `openclaw_notifications` ADD CONSTRAINT `openclaw_notif_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `openclaw_preferences` ADD CONSTRAINT `openclaw_prefs_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ocn_user_idx` ON `openclaw_notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `ocn_type_idx` ON `openclaw_notifications` (`type`);--> statement-breakpoint
CREATE INDEX `ocn_status_idx` ON `openclaw_notifications` (`status`);--> statement-breakpoint
CREATE INDEX `ocn_created_idx` ON `openclaw_notifications` (`createdAt`);