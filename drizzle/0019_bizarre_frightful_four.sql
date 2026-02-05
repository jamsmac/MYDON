CREATE INDEX `user_idx` ON `projects` (`userId`);--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `section_idx` ON `tasks` (`sectionId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `deadline_idx` ON `tasks` (`deadline`);--> statement-breakpoint
CREATE INDEX `assigned_to_idx` ON `tasks` (`assignedTo`);