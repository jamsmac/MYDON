CREATE TABLE `api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`keyHash` varchar(255) NOT NULL,
	`keyPrefix` varchar(12) NOT NULL,
	`scopes` json NOT NULL,
	`rateLimit` int DEFAULT 1000,
	`expiresAt` timestamp,
	`lastUsedAt` timestamp,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`apiKeyId` int NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`method` varchar(10) NOT NULL,
	`statusCode` int,
	`responseTime` int,
	`requestSize` int,
	`responseSize` int,
	`ipAddress` varchar(45),
	`userAgent` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhook_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhookId` int NOT NULL,
	`event` varchar(100) NOT NULL,
	`payload` json NOT NULL,
	`responseStatus` int,
	`responseBody` text,
	`duration` int,
	`success` boolean DEFAULT false,
	`error` text,
	`attempts` int DEFAULT 1,
	`nextRetryAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webhook_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`name` varchar(255) NOT NULL,
	`url` varchar(2048) NOT NULL,
	`secret` varchar(255),
	`events` json NOT NULL,
	`headers` json,
	`isActive` boolean DEFAULT true,
	`lastTriggeredAt` timestamp,
	`failureCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhooks_id` PRIMARY KEY(`id`)
);
