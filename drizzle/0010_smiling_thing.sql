CREATE TABLE `comment_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commentId` int NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comment_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`role` enum('editor','viewer') NOT NULL DEFAULT 'viewer',
	`token` varchar(64) NOT NULL,
	`invitedBy` int NOT NULL,
	`status` enum('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','editor','viewer') NOT NULL DEFAULT 'viewer',
	`invitedBy` int,
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`parentId` int,
	`mentions` json,
	`isEdited` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_comments_id` PRIMARY KEY(`id`)
);
