CREATE TABLE `ai_model_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelName` varchar(128) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`ratingReasoning` int DEFAULT 50,
	`ratingCoding` int DEFAULT 50,
	`ratingCreative` int DEFAULT 50,
	`ratingTranslation` int DEFAULT 50,
	`ratingSummarization` int DEFAULT 50,
	`ratingPlanning` int DEFAULT 50,
	`ratingRiskAnalysis` int DEFAULT 50,
	`ratingDataAnalysis` int DEFAULT 50,
	`ratingDocumentation` int DEFAULT 50,
	`ratingChat` int DEFAULT 50,
	`overallRating` int DEFAULT 50,
	`speedRating` int DEFAULT 50,
	`costEfficiency` int DEFAULT 50,
	`avgResponseTimeMs` int DEFAULT 0,
	`avgTokensPerRequest` int DEFAULT 0,
	`successRate` int DEFAULT 100,
	`totalRequests` int DEFAULT 0,
	`ratingSource` enum('manual','benchmark','user_feedback','auto') DEFAULT 'manual',
	`lastBenchmarkAt` timestamp,
	`modelPricingId` int,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_model_ratings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_model_ratings_modelName_unique` UNIQUE(`modelName`)
);
--> statement-breakpoint
CREATE TABLE `ai_model_task_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskCategory` varchar(64) NOT NULL,
	`entityType` enum('project','block','section','task','any') DEFAULT 'any',
	`primaryModelName` varchar(128) NOT NULL,
	`fallbackModelName` varchar(128),
	`agentId` int,
	`skillId` int,
	`selectionReason` varchar(255),
	`isManualOverride` boolean DEFAULT false,
	`isActive` boolean DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_model_task_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `task_category_entity_idx` UNIQUE(`taskCategory`,`entityType`)
);
--> statement-breakpoint
CREATE TABLE `task_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int NOT NULL,
	`remindAt` timestamp NOT NULL,
	`channel` enum('telegram','web','email') NOT NULL DEFAULT 'web',
	`chatId` varchar(64),
	`status` enum('pending','sent','cancelled') DEFAULT 'pending',
	`message` text,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','blocked') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `blockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `blockedReason` text;--> statement-breakpoint
ALTER TABLE `task_reminders` ADD CONSTRAINT `task_reminders_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_reminders` ADD CONSTRAINT `task_reminders_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `tr_status_remind_idx` ON `task_reminders` (`status`,`remindAt`);--> statement-breakpoint
CREATE INDEX `tr_user_idx` ON `task_reminders` (`userId`);--> statement-breakpoint
CREATE INDEX `tr_task_idx` ON `task_reminders` (`taskId`);