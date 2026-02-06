CREATE TABLE `task_dependencies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`dependsOnTaskId` int NOT NULL,
	`dependencyType` enum('finish_to_start','start_to_start','finish_to_finish','start_to_finish') DEFAULT 'finish_to_start',
	`lagDays` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `task_dependencies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `td_task_idx` ON `task_dependencies` (`taskId`);--> statement-breakpoint
CREATE INDEX `td_depends_on_idx` ON `task_dependencies` (`dependsOnTaskId`);