CREATE TABLE `discussion_read_status` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entityType` enum('project','block','section','task') NOT NULL,
	`entityId` int NOT NULL,
	`lastReadAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discussion_read_status_id` PRIMARY KEY(`id`)
);
