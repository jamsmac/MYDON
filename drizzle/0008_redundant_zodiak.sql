CREATE TABLE `attachment_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`maxFileSizeMB` int DEFAULT 100,
	`maxTotalStorageMB` int DEFAULT 10000,
	`maxFilesPerEntity` int DEFAULT 50,
	`maxFilesPerMessage` int DEFAULT 10,
	`maxFileContentForAI_KB` int DEFAULT 100,
	`allowedMimeTypes` json DEFAULT ('["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","image/png","image/jpeg","image/gif","image/webp","image/svg+xml","text/plain","text/markdown","text/csv","application/json","application/zip","application/x-rar-compressed","video/mp4","audio/mpeg","audio/wav"]'),
	`planOverrides` json,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `attachment_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `file_attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`entityType` enum('project','block','section','task') NOT NULL,
	`entityId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`fileName` varchar(512) NOT NULL,
	`fileKey` varchar(1024) NOT NULL,
	`fileUrl` text,
	`mimeType` varchar(128) NOT NULL,
	`fileSize` int NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `file_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `task_comments` ADD `attachmentIds` json;--> statement-breakpoint
ALTER TABLE `file_attachments` ADD CONSTRAINT `fa_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `file_attachments` ADD CONSTRAINT `fa_uploaded_by_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `fa_entity_idx` ON `file_attachments` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `fa_project_idx` ON `file_attachments` (`projectId`);--> statement-breakpoint
CREATE INDEX `fa_uploaded_by_idx` ON `file_attachments` (`uploadedBy`);