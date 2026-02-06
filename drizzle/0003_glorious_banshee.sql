CREATE TABLE `admin_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`category` varchar(32) NOT NULL,
	`targetType` varchar(32),
	`targetId` int,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`smtpHost` varchar(255),
	`smtpPort` int DEFAULT 587,
	`smtpUser` varchar(255),
	`smtpPassword` text,
	`smtpSecure` boolean DEFAULT true,
	`fromEmail` varchar(255),
	`fromName` varchar(128),
	`isEnabled` boolean DEFAULT false,
	`lastTestedAt` timestamp,
	`lastTestResult` enum('success','failed'),
	`lastTestError` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`bodyHtml` text NOT NULL,
	`bodyText` text,
	`variables` json,
	`isActive` boolean DEFAULT true,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_templates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `platform_api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`apiKey` text NOT NULL,
	`status` enum('valid','invalid','expired','rate_limited') DEFAULT 'valid',
	`lastVerifiedAt` timestamp,
	`lastErrorMessage` text,
	`totalRequests` int DEFAULT 0,
	`totalTokens` int DEFAULT 0,
	`isEnabled` boolean DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('error_spike','credits_low','api_key_invalid','webhook_failed','usage_limit','security') NOT NULL,
	`severity` enum('info','warning','critical') DEFAULT 'warning',
	`title` varchar(255) NOT NULL,
	`message` text,
	`data` json,
	`isResolved` boolean DEFAULT false,
	`resolvedAt` timestamp,
	`resolvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `aal_user_idx` ON `admin_activity_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `aal_action_idx` ON `admin_activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `aal_category_idx` ON `admin_activity_logs` (`category`);--> statement-breakpoint
CREATE INDEX `aal_created_idx` ON `admin_activity_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `et_slug_idx` ON `email_templates` (`slug`);--> statement-breakpoint
CREATE INDEX `pak_provider_idx` ON `platform_api_keys` (`provider`);--> statement-breakpoint
CREATE INDEX `sa_type_idx` ON `system_alerts` (`type`);--> statement-breakpoint
CREATE INDEX `sa_severity_idx` ON `system_alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `sa_resolved_idx` ON `system_alerts` (`isResolved`);