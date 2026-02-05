CREATE TABLE `ai_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cache_key` varchar(32) NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`model` varchar(50) NOT NULL,
	`task_type` varchar(20),
	`tokens` int,
	`cost` decimal(10,6),
	`hit_count` int DEFAULT 0,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_cache_cache_key_unique` UNIQUE(`cache_key`)
);
--> statement-breakpoint
CREATE TABLE `ai_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`session_id` varchar(36),
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`model` varchar(50) NOT NULL,
	`task_type` varchar(20),
	`tokens` int,
	`cost` decimal(10,6),
	`from_cache` boolean DEFAULT false,
	`execution_time` int,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_sessions` (
	`id` varchar(36) NOT NULL,
	`user_id` int NOT NULL,
	`title` varchar(255) DEFAULT 'New Chat',
	`project_id` int,
	`last_message_at` timestamp,
	`message_count` int DEFAULT 0,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_usage_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`date` date NOT NULL,
	`total_requests` int DEFAULT 0,
	`cached_requests` int DEFAULT 0,
	`total_tokens` int DEFAULT 0,
	`total_cost` decimal(10,4) DEFAULT '0.0000',
	`model_usage` json,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `ai_usage_stats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_cache_key_idx` ON `ai_cache` (`cache_key`);--> statement-breakpoint
CREATE INDEX `ai_expires_at_idx` ON `ai_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `ai_requests_user_id_idx` ON `ai_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_requests_session_id_idx` ON `ai_requests` (`session_id`);--> statement-breakpoint
CREATE INDEX `ai_sessions_user_id_idx` ON `ai_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_user_date_idx` ON `ai_usage_stats` (`user_id`,`date`);