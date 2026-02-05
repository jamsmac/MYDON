CREATE TABLE `pitch_decks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`slides` json NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastEditedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`exportedUrl` text,
	`exportFormat` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pitch_decks_id` PRIMARY KEY(`id`)
);
