CREATE TABLE `template_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameRu` varchar(100),
	`icon` varchar(64) DEFAULT 'folder',
	`color` varchar(32) DEFAULT '#f59e0b',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_templates` MODIFY COLUMN `icon` varchar(64) DEFAULT 'layout-template';--> statement-breakpoint
ALTER TABLE `project_templates` ADD `color` varchar(32) DEFAULT '#8b5cf6';--> statement-breakpoint
ALTER TABLE `project_templates` ADD `categoryId` int;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `authorId` int NOT NULL;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `authorName` varchar(255);--> statement-breakpoint
ALTER TABLE `project_templates` ADD `blocksCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `sectionsCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `tasksCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `estimatedDuration` varchar(64);--> statement-breakpoint
ALTER TABLE `project_templates` ADD `usageCount` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `rating` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `project_templates` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `project_templates` DROP COLUMN `createdBy`;