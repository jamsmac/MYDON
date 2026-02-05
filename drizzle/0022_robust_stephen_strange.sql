CREATE TABLE `entity_relations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceType` enum('project','block','section','task','subtask') NOT NULL,
	`sourceId` int NOT NULL,
	`targetType` enum('project','block','section','task','subtask') NOT NULL,
	`targetId` int NOT NULL,
	`relationType` enum('parent_child','blocks','blocked_by','related_to','duplicate_of','depends_on','required_by','subtask_of','linked','cloned_from','moved_from') NOT NULL,
	`isBidirectional` boolean DEFAULT true,
	`reverseRelationType` varchar(50),
	`createdBy` int NOT NULL,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `entity_relations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kanban_columns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`viewConfigId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`color` varchar(32),
	`icon` varchar(64),
	`description` text,
	`columnType` enum('status','priority','assignee','tag','custom') NOT NULL,
	`matchValue` varchar(255),
	`matchField` varchar(100),
	`customFilter` json,
	`taskLimit` int,
	`showLimitWarning` boolean DEFAULT true,
	`limitWarningThreshold` int DEFAULT 80,
	`isCollapsed` boolean DEFAULT false,
	`isHidden` boolean DEFAULT false,
	`allowDrop` boolean DEFAULT true,
	`autoActions` json,
	`defaultValues` json,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kanban_columns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lookup_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('project','block','section','task') NOT NULL,
	`entityId` int,
	`name` varchar(100) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`description` text,
	`relationId` int,
	`relationType` varchar(50),
	`sourceProperty` varchar(100) NOT NULL,
	`displayFormat` enum('text','badge','avatar','date','datetime','progress_bar','link','list','number','currency','percentage') DEFAULT 'text',
	`aggregation` enum('first','last','all','count','comma_list','unique') DEFAULT 'first',
	`formatOptions` json,
	`isVisible` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lookup_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rollup_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` enum('project','block','section','task') NOT NULL,
	`entityId` int,
	`name` varchar(100) NOT NULL,
	`displayName` varchar(255) NOT NULL,
	`description` text,
	`sourceRelationType` varchar(50) NOT NULL,
	`sourceProperty` varchar(100) NOT NULL,
	`aggregationFunction` enum('count','count_values','count_unique','count_checked','count_unchecked','sum','average','median','min','max','range','percent_empty','percent_not_empty','percent_checked','percent_unchecked','earliest_date','latest_date','date_range_days','show_original','concatenate') NOT NULL,
	`filterConditions` json,
	`displayFormat` enum('number','percentage','currency','duration','date','progress_bar','text','fraction') DEFAULT 'number',
	`decimalPlaces` int DEFAULT 0,
	`prefix` varchar(20),
	`suffix` varchar(20),
	`progressBarMax` int,
	`progressBarColor` varchar(32),
	`cachedValue` text,
	`lastCalculatedAt` timestamp,
	`cacheExpiresAt` timestamp,
	`isVisible` boolean DEFAULT true,
	`sortOrder` int DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rollup_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(32) NOT NULL DEFAULT '#6366f1',
	`icon` varchar(64),
	`description` text,
	`tagType` enum('label','category','status','sprint','epic','component','custom') DEFAULT 'label',
	`usageCount` int DEFAULT 0,
	`isArchived` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`tagId` int NOT NULL,
	`addedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `tt_unique_idx` UNIQUE(`taskId`,`tagId`)
);
--> statement-breakpoint
CREATE TABLE `view_configs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`icon` varchar(64) DEFAULT 'table',
	`color` varchar(32),
	`description` text,
	`viewType` enum('table','kanban','calendar','gallery','timeline','list','board') NOT NULL,
	`scope` enum('project','block','section','filtered') DEFAULT 'project',
	`scopeId` int,
	`columns` json,
	`filters` json,
	`sorts` json,
	`groupBy` varchar(100),
	`subGroupBy` varchar(100),
	`calendarDateField` varchar(100),
	`calendarShowWeekends` boolean DEFAULT true,
	`galleryCoverField` varchar(100),
	`galleryCardSize` enum('small','medium','large') DEFAULT 'medium',
	`timelineStartField` varchar(100) DEFAULT 'startDate',
	`timelineEndField` varchar(100) DEFAULT 'deadline',
	`timelineShowDependencies` boolean DEFAULT true,
	`showCompletedTasks` boolean DEFAULT true,
	`showSubtasks` boolean DEFAULT false,
	`showEmptyGroups` boolean DEFAULT true,
	`collapsedGroups` json,
	`rowHeight` enum('compact','normal','comfortable') DEFAULT 'normal',
	`isShared` boolean DEFAULT false,
	`isDefault` boolean DEFAULT false,
	`isLocked` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `view_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `er_source_idx` ON `entity_relations` (`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `er_target_idx` ON `entity_relations` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `er_relation_type_idx` ON `entity_relations` (`relationType`);--> statement-breakpoint
CREATE INDEX `er_created_by_idx` ON `entity_relations` (`createdBy`);--> statement-breakpoint
CREATE INDEX `kc_view_config_idx` ON `kanban_columns` (`viewConfigId`);--> statement-breakpoint
CREATE INDEX `kc_column_type_idx` ON `kanban_columns` (`columnType`);--> statement-breakpoint
CREATE INDEX `lf_entity_idx` ON `lookup_fields` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `lf_relation_type_idx` ON `lookup_fields` (`relationType`);--> statement-breakpoint
CREATE INDEX `rf_entity_idx` ON `rollup_fields` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `rf_source_relation_idx` ON `rollup_fields` (`sourceRelationType`);--> statement-breakpoint
CREATE INDEX `tags_project_idx` ON `tags` (`projectId`);--> statement-breakpoint
CREATE INDEX `tags_user_idx` ON `tags` (`userId`);--> statement-breakpoint
CREATE INDEX `tags_name_idx` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `tags_type_idx` ON `tags` (`tagType`);--> statement-breakpoint
CREATE INDEX `tt_task_idx` ON `task_tags` (`taskId`);--> statement-breakpoint
CREATE INDEX `tt_tag_idx` ON `task_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `vc_project_user_idx` ON `view_configs` (`projectId`,`userId`);--> statement-breakpoint
CREATE INDEX `vc_view_type_idx` ON `view_configs` (`viewType`);--> statement-breakpoint
CREATE INDEX `vc_is_default_idx` ON `view_configs` (`isDefault`);