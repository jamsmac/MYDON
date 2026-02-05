CREATE TABLE `ai_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`autoSelectEnabled` boolean DEFAULT true,
	`preferFreeModels` boolean DEFAULT true,
	`simpleTaskProvider` int,
	`analysisTaskProvider` int,
	`codeTaskProvider` int,
	`creativeTaskProvider` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
ALTER TABLE `ai_settings` MODIFY COLUMN `provider` enum('anthropic','openai','google','groq','mistral','gemini_free','huggingface','deepseek','ollama','cohere','perplexity') NOT NULL;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `baseUrl` varchar(255);--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `isFree` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD `priority` int DEFAULT 0;