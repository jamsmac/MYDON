CREATE TABLE `template_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`userId` int NOT NULL,
	`createdProjectId` int,
	`downloadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_downloads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`review` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `template_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`nameRu` varchar(64),
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `template_to_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `template_to_tags_id` PRIMARY KEY(`id`)
);
