ALTER TABLE `tasks` ADD `priority` enum('critical','high','medium','low') DEFAULT 'medium';--> statement-breakpoint
ALTER TABLE `tasks` ADD `deadline` timestamp;--> statement-breakpoint
ALTER TABLE `tasks` ADD `dependencies` json;