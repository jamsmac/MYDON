CREATE TABLE `custom_field_values` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customFieldId` int NOT NULL,
	`taskId` int NOT NULL,
	`value` text,
	`numericValue` decimal(15,4),
	`dateValue` timestamp,
	`booleanValue` boolean,
	`jsonValue` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_field_values_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('text','number','date','checkbox','select','multiselect','url','email','formula','rollup','currency','percent','rating','phone') NOT NULL,
	`description` text,
	`options` json,
	`formula` text,
	`rollupConfig` json,
	`currencyCode` varchar(3),
	`sortOrder` int DEFAULT 0,
	`isRequired` boolean DEFAULT false,
	`showOnCard` boolean DEFAULT false,
	`showInTable` boolean DEFAULT true,
	`defaultValue` text,
	`minValue` decimal(15,2),
	`maxValue` decimal(15,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `custom_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cfv_field_idx` ON `custom_field_values` (`customFieldId`);--> statement-breakpoint
CREATE INDEX `cfv_task_idx` ON `custom_field_values` (`taskId`);--> statement-breakpoint
CREATE INDEX `cfv_unique_idx` ON `custom_field_values` (`customFieldId`,`taskId`);--> statement-breakpoint
CREATE INDEX `cf_project_idx` ON `custom_fields` (`projectId`);--> statement-breakpoint
CREATE INDEX `cf_sort_idx` ON `custom_fields` (`projectId`,`sortOrder`);