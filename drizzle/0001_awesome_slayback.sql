CREATE TABLE `credit_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleId` int,
	`userId` int,
	`dailyLimit` int DEFAULT 100,
	`perRequestLimit` int DEFAULT 50,
	`monthlyLimit` int DEFAULT 3000,
	`projectLimit` int,
	`notifyAtPercent` int DEFAULT 80,
	`blockAtPercent` int DEFAULT 100,
	`allowOverride` boolean DEFAULT false,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_limits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelName` varchar(128) NOT NULL,
	`modelDisplayName` varchar(128),
	`provider` varchar(64) NOT NULL,
	`inputCostPer1K` decimal(10,4) NOT NULL DEFAULT '1.0000',
	`outputCostPer1K` decimal(10,4) NOT NULL DEFAULT '2.0000',
	`planRestrictions` json,
	`capabilities` json,
	`isEnabled` boolean DEFAULT true,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_pricing_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_pricing_modelName_unique` UNIQUE(`modelName`)
);
--> statement-breakpoint
CREATE TABLE `pricing_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`nameRu` varchar(64),
	`slug` varchar(64) NOT NULL,
	`description` text,
	`descriptionRu` text,
	`priceMonthly` int DEFAULT 0,
	`priceYearly` int DEFAULT 0,
	`currency` varchar(3) DEFAULT 'USD',
	`creditsPerMonth` int DEFAULT 1000,
	`maxProjects` int DEFAULT 5,
	`maxUsers` int DEFAULT 1,
	`maxStorage` int DEFAULT 100,
	`features` json,
	`color` varchar(32) DEFAULT '#6366f1',
	`icon` varchar(64) DEFAULT 'star',
	`isPopular` boolean DEFAULT false,
	`displayOrder` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`isSystem` boolean DEFAULT false,
	`stripeProductId` varchar(255),
	`stripePriceIdMonthly` varchar(255),
	`stripePriceIdYearly` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_plans_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `user_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` enum('login','logout','project_created','project_deleted','ai_request','ai_generate','settings_changed','password_reset','role_changed','blocked','unblocked','credits_added','credits_spent','invitation_sent','invitation_accepted') NOT NULL,
	`metadata` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(128) NOT NULL,
	`roleId` int,
	`creditLimit` int DEFAULT 1000,
	`status` enum('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
	`invitedBy` int NOT NULL,
	`acceptedBy` int,
	`acceptedAt` timestamp,
	`message` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user_role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_role_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`nameRu` varchar(64),
	`description` text,
	`color` varchar(32) DEFAULT '#6366f1',
	`permissions` json NOT NULL,
	`isSystem` boolean DEFAULT false,
	`isDefault` boolean DEFAULT false,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE INDEX `cl_role_idx` ON `credit_limits` (`roleId`);--> statement-breakpoint
CREATE INDEX `cl_user_idx` ON `credit_limits` (`userId`);--> statement-breakpoint
CREATE INDEX `ual_user_idx` ON `user_activity_log` (`userId`);--> statement-breakpoint
CREATE INDEX `ual_action_idx` ON `user_activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `ual_created_idx` ON `user_activity_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ui_email_idx` ON `user_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `ui_token_idx` ON `user_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `ui_status_idx` ON `user_invitations` (`status`);--> statement-breakpoint
CREATE INDEX `ura_user_idx` ON `user_role_assignments` (`userId`);--> statement-breakpoint
CREATE INDEX `ura_role_idx` ON `user_role_assignments` (`roleId`);