CREATE TABLE `email_digest_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`status` enum('pending','sent','failed') DEFAULT 'pending',
	`sentAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_digest_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`inAppEnabled` boolean DEFAULT true,
	`emailEnabled` boolean DEFAULT true,
	`emailDigestFrequency` enum('none','daily','weekly') DEFAULT 'daily',
	`emailDigestTime` varchar(5) DEFAULT '09:00',
	`telegramEnabled` boolean DEFAULT false,
	`telegramChatId` varchar(64),
	`telegramUsername` varchar(64),
	`pushEnabled` boolean DEFAULT false,
	`pushSubscription` json,
	`notifyTaskAssigned` boolean DEFAULT true,
	`notifyTaskCompleted` boolean DEFAULT true,
	`notifyTaskOverdue` boolean DEFAULT true,
	`notifyComments` boolean DEFAULT true,
	`notifyMentions` boolean DEFAULT true,
	`notifyProjectUpdates` boolean DEFAULT true,
	`notifyDeadlines` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('task_assigned','task_completed','task_overdue','comment_added','comment_mention','project_invite','project_update','deadline_reminder','daily_digest','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`data` json,
	`isRead` boolean DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
