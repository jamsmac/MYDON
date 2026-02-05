CREATE TABLE `ai_chat_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`blockId` int,
	`sectionId` int,
	`taskId` int,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`model` varchar(100),
	`creditsUsed` int DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_chat_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`taskId` int,
	`suggestionType` enum('title','description','subtasks','priority','deadline','similar') NOT NULL,
	`suggestion` json NOT NULL,
	`confidence` int DEFAULT 0,
	`accepted` boolean DEFAULT false,
	`dismissed` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `ai_suggestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`keyMetrics` json,
	`risks` json,
	`achievements` json,
	`recommendations` json,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_risks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`blockId` int,
	`taskId` int,
	`riskType` enum('blocked','overdue','dependency','resource','scope','deadline','quality') NOT NULL,
	`severity` enum('low','medium','high','critical') DEFAULT 'medium',
	`title` varchar(255) NOT NULL,
	`description` text,
	`recommendation` text,
	`status` enum('open','mitigated','resolved','accepted') DEFAULT 'open',
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_risks_id` PRIMARY KEY(`id`)
);
