CREATE TABLE `user_project_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`groupBy` enum('none','tag','status','priority') DEFAULT 'none',
	`activeFilter` enum('all','not_started','in_progress','completed','overdue') DEFAULT 'all',
	`collapsedGroups` json,
	`collapsedSections` json,
	`sidebarCollapsed` boolean DEFAULT false,
	`lastViewedBlockId` varchar(100),
	`lastViewedSectionId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_project_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `upp_project_user_idx` UNIQUE(`projectId`,`userId`)
);
