CREATE TABLE `saved_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`viewType` enum('table','kanban','calendar','gantt','all') NOT NULL DEFAULT 'all',
	`config` json NOT NULL,
	`icon` varchar(50),
	`color` varchar(20),
	`isDefault` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `sv_project_idx` ON `saved_views` (`projectId`);--> statement-breakpoint
CREATE INDEX `sv_user_idx` ON `saved_views` (`userId`);