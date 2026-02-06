CREATE TABLE `localization_strings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`locale` varchar(10) NOT NULL,
	`value` text NOT NULL,
	`context` varchar(128),
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localization_strings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `navbar_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameRu` varchar(128),
	`icon` varchar(64),
	`path` varchar(255),
	`isEnabled` boolean DEFAULT true,
	`isCustom` boolean DEFAULT false,
	`displayOrder` int DEFAULT 0,
	`externalUrl` varchar(512),
	`openInNewTab` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `navbar_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`version` int NOT NULL,
	`content` text NOT NULL,
	`variables` json,
	`changeNote` text,
	`changedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'custom',
	`description` text,
	`content` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`variables` json,
	`linkedAgents` json,
	`isActive` boolean DEFAULT true,
	`isSystem` boolean DEFAULT false,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_prompts_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_prompts_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `ui_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` json NOT NULL,
	`description` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ui_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ui_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE INDEX `ls_key_locale_idx` ON `localization_strings` (`key`,`locale`);--> statement-breakpoint
CREATE INDEX `ls_context_idx` ON `localization_strings` (`context`);--> statement-breakpoint
CREATE INDEX `ni_order_idx` ON `navbar_items` (`displayOrder`);--> statement-breakpoint
CREATE INDEX `pv_prompt_idx` ON `prompt_versions` (`promptId`);--> statement-breakpoint
CREATE INDEX `pv_version_idx` ON `prompt_versions` (`version`);--> statement-breakpoint
CREATE INDEX `sp_slug_idx` ON `system_prompts` (`slug`);--> statement-breakpoint
CREATE INDEX `sp_category_idx` ON `system_prompts` (`category`);