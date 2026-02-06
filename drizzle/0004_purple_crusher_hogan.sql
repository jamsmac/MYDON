ALTER TABLE `task_comments` MODIFY COLUMN `taskId` int;--> statement-breakpoint
ALTER TABLE `task_comments` ADD `entityType` enum('project','block','section','task') DEFAULT 'task' NOT NULL;--> statement-breakpoint
ALTER TABLE `task_comments` ADD `entityId` int;--> statement-breakpoint
ALTER TABLE `task_comments` ADD `isSummary` boolean DEFAULT false;