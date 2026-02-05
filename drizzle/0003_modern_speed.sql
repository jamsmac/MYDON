CREATE TABLE `credit_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`balance` int NOT NULL,
	`type` enum('initial','bonus','purchase','ai_request','ai_generate','refund') NOT NULL,
	`description` text,
	`model` varchar(64),
	`tokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `credit_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_credits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`credits` int NOT NULL DEFAULT 1000,
	`totalEarned` int NOT NULL DEFAULT 1000,
	`totalSpent` int NOT NULL DEFAULT 0,
	`useBYOK` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_credits_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_credits_userId_unique` UNIQUE(`userId`)
);
