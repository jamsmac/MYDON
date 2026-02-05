CREATE TABLE `achievement_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`icon` varchar(64) NOT NULL,
	`category` enum('productivity','collaboration','milestone','streak','special') DEFAULT 'milestone',
	`rarity` enum('common','uncommon','rare','epic','legendary') DEFAULT 'common',
	`points` int DEFAULT 10,
	`criteria` json NOT NULL,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `achievement_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int NOT NULL,
	`projectId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`duration` int,
	`notes` text,
	`isRunning` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`targetHours` int NOT NULL,
	`period` enum('daily','weekly','monthly') DEFAULT 'daily',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementId` int NOT NULL,
	`progress` int DEFAULT 0,
	`unlockedAt` timestamp,
	`notifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalPoints` int DEFAULT 0,
	`level` int DEFAULT 1,
	`tasksCompleted` int DEFAULT 0,
	`projectsCompleted` int DEFAULT 0,
	`totalTimeTracked` int DEFAULT 0,
	`currentStreak` int DEFAULT 0,
	`longestStreak` int DEFAULT 0,
	`lastActivityDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_stats_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE INDEX `te_user_idx` ON `time_entries` (`userId`);--> statement-breakpoint
CREATE INDEX `te_task_idx` ON `time_entries` (`taskId`);--> statement-breakpoint
CREATE INDEX `te_project_idx` ON `time_entries` (`projectId`);--> statement-breakpoint
CREATE INDEX `ua_user_idx` ON `user_achievements` (`userId`);--> statement-breakpoint
CREATE INDEX `ua_achievement_idx` ON `user_achievements` (`achievementId`);