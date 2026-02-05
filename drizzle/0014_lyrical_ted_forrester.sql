CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`action` enum('task_created','task_updated','task_completed','task_deleted','subtask_created','subtask_completed','comment_added','comment_edited','member_invited','member_joined','member_removed','block_created','block_updated','section_created','section_updated','project_updated','deadline_set','priority_changed','assignment_changed') NOT NULL,
	`entityType` enum('project','block','section','task','subtask','comment','member') NOT NULL,
	`entityId` int NOT NULL,
	`entityTitle` varchar(500),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `project_invitations` DROP INDEX `project_invitations_token_unique`;--> statement-breakpoint
ALTER TABLE `project_invitations` MODIFY COLUMN `email` varchar(320);--> statement-breakpoint
ALTER TABLE `project_invitations` MODIFY COLUMN `role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `project_invitations` MODIFY COLUMN `expiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `project_members` MODIFY COLUMN `role` enum('owner','admin','editor','viewer') NOT NULL DEFAULT 'viewer';--> statement-breakpoint
ALTER TABLE `project_invitations` ADD `inviteCode` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD `usedAt` timestamp;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD `usedBy` int;--> statement-breakpoint
ALTER TABLE `project_members` ADD `joinedAt` timestamp;--> statement-breakpoint
ALTER TABLE `project_members` ADD `status` enum('pending','active','removed') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `assignedTo` int;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD CONSTRAINT `project_invitations_inviteCode_unique` UNIQUE(`inviteCode`);--> statement-breakpoint
ALTER TABLE `project_invitations` DROP COLUMN `token`;--> statement-breakpoint
ALTER TABLE `project_invitations` DROP COLUMN `status`;--> statement-breakpoint
ALTER TABLE `project_invitations` DROP COLUMN `updatedAt`;--> statement-breakpoint
ALTER TABLE `project_members` DROP COLUMN `acceptedAt`;