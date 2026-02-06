CREATE TABLE `achievement_definitions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`icon` varchar(64) NOT NULL,
	`category` enum('productivity','collaboration','milestone','streak','special') DEFAULT 'milestone',
	`rarity` enum('common','uncommon','rare','epic','legendary') DEFAULT 'common',
	`points` int DEFAULT 10,
	`criteria` json NOT NULL,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `achievement_definitions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`userId` int NOT NULL,
	`action` enum('task_created','task_updated','task_completed','task_deleted','subtask_created','subtask_completed','comment_added','comment_edited','member_invited','member_joined','member_removed','block_created','block_updated','section_created','section_updated','project_created','project_updated','deadline_set','priority_changed','assignment_changed','ai_request','ai_analysis','ai_code_generation','decision_created','decision_finalized') NOT NULL,
	`entityType` enum('project','block','section','task','subtask','comment','member','ai','decision') NOT NULL,
	`entityId` int,
	`entityTitle` varchar(500),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `admin_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` varchar(64) NOT NULL,
	`category` varchar(32) NOT NULL,
	`targetType` varchar(32),
	`targetId` int,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `admin_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameRu` varchar(100),
	`slug` varchar(50) NOT NULL,
	`description` text,
	`descriptionRu` text,
	`type` enum('code','research','writing','planning','analysis','general') NOT NULL,
	`capabilities` json,
	`systemPrompt` text,
	`modelPreference` varchar(50),
	`fallbackModel` varchar(50),
	`temperature` int DEFAULT 70,
	`maxTokens` int DEFAULT 4096,
	`triggerPatterns` json,
	`priority` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`isSystem` boolean DEFAULT false,
	`totalRequests` int DEFAULT 0,
	`avgResponseTime` int DEFAULT 0,
	`successRate` int DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_agents_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_agents_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
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
CREATE TABLE `ai_chat_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`blockId` int,
	`sectionId` int,
	`taskId` int,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`model` varchar(100),
	`creditsUsed` int DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_chat_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`isFinalized` boolean DEFAULT false,
	`decisionRecordId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_chat_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionUuid` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`taskId` varchar(100),
	`title` varchar(255) DEFAULT 'Новый чат',
	`messageCount` int DEFAULT 0,
	`lastMessageAt` timestamp,
	`isArchived` boolean DEFAULT false,
	`isPinned` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_chat_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_chat_sessions_sessionUuid_unique` UNIQUE(`sessionUuid`),
	CONSTRAINT `acs_uuid_idx` UNIQUE(`sessionUuid`)
);
--> statement-breakpoint
CREATE TABLE `ai_decision_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int,
	`projectId` int,
	`taskId` varchar(100),
	`blockId` varchar(100),
	`userId` int NOT NULL,
	`question` text NOT NULL,
	`aiResponse` text NOT NULL,
	`finalDecision` text NOT NULL,
	`keyPoints` json,
	`actionItems` json,
	`decisionType` enum('technical','business','design','process','architecture','other') DEFAULT 'other',
	`tags` json,
	`status` enum('active','implemented','obsolete','superseded') DEFAULT 'active',
	`supersededBy` int,
	`importance` enum('critical','high','medium','low') DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_decision_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(50) NOT NULL,
	`displayName` varchar(100),
	`apiKey` text,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`config` json,
	`isActive` boolean DEFAULT true,
	`lastUsedAt` timestamp,
	`lastErrorAt` timestamp,
	`lastError` text,
	`totalRequests` int DEFAULT 0,
	`totalTokens` int DEFAULT 0,
	`totalCost` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `ai_request_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`requestType` enum('chat','generate','skill','mcp') NOT NULL,
	`agentId` int,
	`skillId` int,
	`mcpServerId` int,
	`input` text,
	`output` text,
	`model` varchar(64),
	`provider` varchar(50),
	`tokensUsed` int,
	`responseTimeMs` int,
	`status` enum('success','error','timeout','rate_limited') DEFAULT 'success',
	`errorMessage` text,
	`creditsCost` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_request_logs_id` PRIMARY KEY(`id`)
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
CREATE TABLE `ai_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` enum('anthropic','openai','google','groq','mistral','gemini_free','huggingface','deepseek','ollama','cohere','perplexity') NOT NULL,
	`apiKey` text,
	`model` varchar(64),
	`baseUrl` varchar(255),
	`isDefault` boolean DEFAULT false,
	`isEnabled` boolean DEFAULT true,
	`isFree` boolean DEFAULT false,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_skills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameRu` varchar(100),
	`slug` varchar(50) NOT NULL,
	`description` text,
	`agentId` int,
	`triggerPatterns` json,
	`handlerType` enum('prompt','function','mcp','webhook') DEFAULT 'prompt',
	`handlerConfig` json,
	`inputSchema` json,
	`outputSchema` json,
	`isActive` boolean DEFAULT true,
	`isSystem` boolean DEFAULT false,
	`totalInvocations` int DEFAULT 0,
	`avgExecutionTime` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_skills_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_skills_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `ai_suggestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`taskId` int,
	`suggestionType` enum('title','description','subtasks','priority','deadline','similar') NOT NULL,
	`suggestion` json NOT NULL,
	`confidence` int DEFAULT 0,
	`accepted` boolean DEFAULT false,
	`dismissed` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `ai_suggestions_id` PRIMARY KEY(`id`)
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
CREATE TABLE `ai_usage_tracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`requestCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_usage_tracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`number` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`titleRu` varchar(255),
	`description` text,
	`icon` varchar(64) DEFAULT 'layers',
	`duration` varchar(64),
	`deadline` timestamp,
	`reminderDays` int DEFAULT 3,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`contextType` enum('project','block','section','task') NOT NULL,
	`contextId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`provider` varchar(32),
	`model` varchar(64),
	`tokensUsed` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comment_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commentId` int NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comment_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `credit_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleId` int,
	`userId` int,
	`dailyLimit` int DEFAULT 100,
	`perRequestLimit` int DEFAULT 50,
	`monthlyLimit` int DEFAULT 3000,
	`projectLimit` int,
	`notifyAtPercent` int DEFAULT 80,
	`blockAtPercent` int DEFAULT 100,
	`allowOverride` boolean DEFAULT false,
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `credit_limits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `email_digest_queue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`scheduledFor` timestamp NOT NULL,
	`status` enum('pending','sent','failed') DEFAULT 'pending',
	`sentAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_digest_queue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`smtpHost` varchar(255),
	`smtpPort` int DEFAULT 587,
	`smtpUser` varchar(255),
	`smtpPassword` text,
	`smtpSecure` boolean DEFAULT true,
	`fromEmail` varchar(255),
	`fromName` varchar(128),
	`isEnabled` boolean DEFAULT false,
	`lastTestedAt` timestamp,
	`lastTestResult` enum('success','failed'),
	`lastTestError` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(64) NOT NULL,
	`name` varchar(128) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`bodyHtml` text NOT NULL,
	`bodyText` text,
	`variables` json,
	`isActive` boolean DEFAULT true,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_templates_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
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
CREATE TABLE `executive_summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`summary` text NOT NULL,
	`keyMetrics` json,
	`risks` json,
	`achievements` json,
	`recommendations` json,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_summaries_id` PRIMARY KEY(`id`)
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
CREATE TABLE `localization_strings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(255) NOT NULL,
	`locale` varchar(10) NOT NULL,
	`value` text NOT NULL,
	`context` varchar(128),
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `localization_strings_id` PRIMARY KEY(`id`)
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
CREATE TABLE `mcp_servers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(50) NOT NULL,
	`description` text,
	`endpoint` varchar(500) NOT NULL,
	`protocol` enum('stdio','http','websocket') DEFAULT 'http',
	`authType` enum('none','api_key','oauth','basic') DEFAULT 'none',
	`authConfig` json,
	`tools` json,
	`status` enum('active','inactive','error','connecting') DEFAULT 'inactive',
	`lastHealthCheck` timestamp,
	`lastError` text,
	`totalRequests` int DEFAULT 0,
	`avgResponseTime` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mcp_servers_id` PRIMARY KEY(`id`),
	CONSTRAINT `mcp_servers_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `model_comparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`prompt` text NOT NULL,
	`title` varchar(255),
	`results` json,
	`totalCost` decimal(10,4),
	`modelsCompared` int DEFAULT 0,
	`preferredModel` varchar(64),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `model_comparisons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `model_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modelName` varchar(128) NOT NULL,
	`modelDisplayName` varchar(128),
	`provider` varchar(64) NOT NULL,
	`inputCostPer1K` decimal(10,4) NOT NULL DEFAULT '1.0000',
	`outputCostPer1K` decimal(10,4) NOT NULL DEFAULT '2.0000',
	`planRestrictions` json,
	`capabilities` json,
	`isEnabled` boolean DEFAULT true,
	`displayOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `model_pricing_id` PRIMARY KEY(`id`),
	CONSTRAINT `model_pricing_modelName_unique` UNIQUE(`modelName`)
);
--> statement-breakpoint
CREATE TABLE `navbar_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`nameRu` varchar(128),
	`icon` varchar(64),
	`path` varchar(255),
	`isEnabled` boolean DEFAULT true,
	`isCustom` boolean DEFAULT false,
	`displayOrder` int DEFAULT 0,
	`externalUrl` varchar(512),
	`openInNewTab` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `navbar_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`inAppEnabled` boolean DEFAULT true,
	`emailEnabled` boolean DEFAULT true,
	`emailDigestFrequency` enum('none','daily','weekly') DEFAULT 'daily',
	`emailDigestTime` varchar(5) DEFAULT '09:00',
	`telegramEnabled` boolean DEFAULT false,
	`telegramChatId` varchar(64),
	`telegramUsername` varchar(64),
	`pushEnabled` boolean DEFAULT false,
	`pushSubscription` json,
	`notifyTaskAssigned` boolean DEFAULT true,
	`notifyTaskCompleted` boolean DEFAULT true,
	`notifyTaskOverdue` boolean DEFAULT true,
	`notifyComments` boolean DEFAULT true,
	`notifyMentions` boolean DEFAULT true,
	`notifyProjectUpdates` boolean DEFAULT true,
	`notifyDeadlines` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_preferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('task_assigned','task_completed','task_overdue','comment_added','comment_mention','project_invite','project_update','deadline_reminder','daily_digest','system') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text,
	`data` json,
	`isRead` boolean DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orchestrator_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`routingRules` json,
	`fallbackAgentId` int,
	`fallbackModel` varchar(50) DEFAULT 'gpt-4o-mini',
	`loggingLevel` enum('debug','info','warn','error') DEFAULT 'info',
	`logRetentionDays` int DEFAULT 30,
	`globalRateLimit` int DEFAULT 100,
	`enableAgentRouting` boolean DEFAULT true,
	`enableSkillMatching` boolean DEFAULT true,
	`enableMCPIntegration` boolean DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orchestrator_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pitch_decks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`slides` json NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastEditedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`exportedUrl` text,
	`exportFormat` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pitch_decks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `platform_api_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(64) NOT NULL,
	`apiKey` text NOT NULL,
	`status` enum('valid','invalid','expired','rate_limited') DEFAULT 'valid',
	`lastVerifiedAt` timestamp,
	`lastErrorMessage` text,
	`totalRequests` int DEFAULT 0,
	`totalTokens` int DEFAULT 0,
	`isEnabled` boolean DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_api_keys_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pricing_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`nameRu` varchar(64),
	`slug` varchar(64) NOT NULL,
	`description` text,
	`descriptionRu` text,
	`priceMonthly` int DEFAULT 0,
	`priceYearly` int DEFAULT 0,
	`currency` varchar(3) DEFAULT 'USD',
	`creditsPerMonth` int DEFAULT 1000,
	`maxProjects` int DEFAULT 5,
	`maxUsers` int DEFAULT 1,
	`maxStorage` int DEFAULT 100,
	`features` json,
	`color` varchar(32) DEFAULT '#6366f1',
	`icon` varchar(64) DEFAULT 'star',
	`isPopular` boolean DEFAULT false,
	`displayOrder` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	`isSystem` boolean DEFAULT false,
	`stripeProductId` varchar(255),
	`stripePriceIdMonthly` varchar(255),
	`stripePriceIdYearly` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pricing_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `pricing_plans_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `project_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`email` varchar(320),
	`inviteCode` varchar(64) NOT NULL,
	`role` enum('admin','editor','viewer') NOT NULL DEFAULT 'viewer',
	`invitedBy` int NOT NULL,
	`expiresAt` timestamp,
	`usedAt` timestamp,
	`usedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `project_invitations_inviteCode_unique` UNIQUE(`inviteCode`)
);
--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','admin','editor','viewer') NOT NULL DEFAULT 'viewer',
	`invitedBy` int,
	`invitedAt` timestamp NOT NULL DEFAULT (now()),
	`joinedAt` timestamp,
	`status` enum('pending','active','removed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_risks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`blockId` int,
	`taskId` int,
	`riskType` enum('blocked','overdue','dependency','resource','scope','deadline','quality') NOT NULL,
	`severity` enum('low','medium','high','critical') DEFAULT 'medium',
	`title` varchar(255) NOT NULL,
	`description` text,
	`recommendation` text,
	`status` enum('open','mitigated','resolved','accepted') DEFAULT 'open',
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_risks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(64) DEFAULT 'layout-template',
	`color` varchar(32) DEFAULT '#8b5cf6',
	`categoryId` int,
	`structure` json,
	`isPublic` boolean DEFAULT false,
	`authorId` int NOT NULL,
	`authorName` varchar(255),
	`blocksCount` int DEFAULT 0,
	`sectionsCount` int DEFAULT 0,
	`tasksCount` int DEFAULT 0,
	`estimatedDuration` varchar(64),
	`usageCount` int DEFAULT 0,
	`rating` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`icon` varchar(64) DEFAULT 'folder',
	`color` varchar(32) DEFAULT '#f59e0b',
	`status` enum('active','archived','completed') DEFAULT 'active',
	`startDate` timestamp,
	`targetDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `prompt_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promptId` int NOT NULL,
	`version` int NOT NULL,
	`content` text NOT NULL,
	`variables` json,
	`changeNote` text,
	`changedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prompt_versions_id` PRIMARY KEY(`id`)
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
CREATE TABLE `sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blockId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameRu` varchar(100),
	`slug` varchar(50) NOT NULL,
	`price` int NOT NULL DEFAULT 0,
	`currency` varchar(3) DEFAULT 'USD',
	`billingPeriod` enum('monthly','yearly','lifetime') DEFAULT 'monthly',
	`creditsPerMonth` int NOT NULL DEFAULT 1000,
	`features` json,
	`maxProjects` int DEFAULT 3,
	`maxAiRequests` int DEFAULT 100,
	`maxTeamMembers` int DEFAULT 1,
	`allowedIntegrations` json,
	`isActive` boolean DEFAULT true,
	`isPopular` boolean DEFAULT false,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `subscription_plans_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `subtask_template_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subtask_template_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subtask_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`isPublic` boolean DEFAULT false,
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subtask_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subtasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`status` enum('not_started','in_progress','completed') DEFAULT 'not_started',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subtasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('error_spike','credits_low','api_key_invalid','webhook_failed','usage_limit','security') NOT NULL,
	`severity` enum('info','warning','critical') DEFAULT 'warning',
	`title` varchar(255) NOT NULL,
	`message` text,
	`data` json,
	`isResolved` boolean DEFAULT false,
	`resolvedAt` timestamp,
	`resolvedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `system_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_prompts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(128) NOT NULL,
	`category` varchar(64) NOT NULL DEFAULT 'custom',
	`description` text,
	`content` text NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`variables` json,
	`linkedAgents` json,
	`isActive` boolean DEFAULT true,
	`isSystem` boolean DEFAULT false,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_prompts_id` PRIMARY KEY(`id`),
	CONSTRAINT `system_prompts_slug_unique` UNIQUE(`slug`)
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
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `task_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`parentId` int,
	`mentions` json,
	`isEdited` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `task_comments_id` PRIMARY KEY(`id`)
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
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`status` enum('not_started','in_progress','completed') DEFAULT 'not_started',
	`priority` enum('critical','high','medium','low') DEFAULT 'medium',
	`notes` text,
	`summary` text,
	`dueDate` timestamp,
	`deadline` timestamp,
	`dependencies` json,
	`assignedTo` int,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`nameRu` varchar(100),
	`icon` varchar(64) DEFAULT 'folder',
	`color` varchar(32) DEFAULT '#f59e0b',
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_downloads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`userId` int NOT NULL,
	`createdProjectId` int,
	`downloadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_downloads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_ratings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`review` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `template_ratings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`nameRu` varchar(64),
	`usageCount` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `template_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `template_tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `template_to_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` int NOT NULL,
	`tagId` int NOT NULL,
	CONSTRAINT `template_to_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskId` int NOT NULL,
	`projectId` int NOT NULL,
	`startTime` timestamp NOT NULL,
	`endTime` timestamp,
	`duration` int,
	`notes` text,
	`isRunning` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `time_goals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectId` int,
	`targetHours` int NOT NULL,
	`period` enum('daily','weekly','monthly') DEFAULT 'daily',
	`isActive` boolean DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_goals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ui_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` json NOT NULL,
	`description` text,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ui_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ui_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `user_achievements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`achievementId` int NOT NULL,
	`progress` int DEFAULT 0,
	`unlockedAt` timestamp,
	`notifiedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_achievements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_activity_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`action` enum('login','logout','project_created','project_deleted','ai_request','ai_generate','settings_changed','password_reset','role_changed','blocked','unblocked','credits_added','credits_spent','invitation_sent','invitation_accepted') NOT NULL,
	`metadata` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_activity_log_id` PRIMARY KEY(`id`)
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
--> statement-breakpoint
CREATE TABLE `user_invitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(128) NOT NULL,
	`roleId` int,
	`creditLimit` int DEFAULT 1000,
	`status` enum('pending','accepted','expired','cancelled') NOT NULL DEFAULT 'pending',
	`invitedBy` int NOT NULL,
	`acceptedBy` int,
	`acceptedAt` timestamp,
	`message` text,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_invitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_invitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `user_project_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`groupBy` enum('none','tag','status','priority') DEFAULT 'none',
	`activeFilter` enum('all','not_started','in_progress','completed','overdue') DEFAULT 'all',
	`collapsedGroups` json,
	`collapsedSections` json,
	`sidebarCollapsed` boolean DEFAULT false,
	`lastViewedBlockId` varchar(100),
	`lastViewedSectionId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_project_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `upp_project_user_idx` UNIQUE(`projectId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`roleId` int NOT NULL,
	`assignedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_role_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`nameRu` varchar(64),
	`description` text,
	`color` varchar(32) DEFAULT '#6366f1',
	`permissions` json NOT NULL,
	`isSystem` boolean DEFAULT false,
	`isDefault` boolean DEFAULT false,
	`priority` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `user_stats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalPoints` int DEFAULT 0,
	`level` int DEFAULT 1,
	`tasksCompleted` int DEFAULT 0,
	`projectsCompleted` int DEFAULT 0,
	`totalTimeTracked` int DEFAULT 0,
	`currentStreak` int DEFAULT 0,
	`longestStreak` int DEFAULT 0,
	`lastActivityDate` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_stats_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `user_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`planId` int NOT NULL,
	`status` enum('active','cancelled','expired','past_due','trialing') DEFAULT 'active',
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`startDate` timestamp NOT NULL DEFAULT (now()),
	`endDate` timestamp,
	`cancelledAt` timestamp,
	`trialEndsAt` timestamp,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`avatar` varchar(512),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`stripeCustomerId` varchar(255),
	`stripeSubscriptionId` varchar(255),
	`subscriptionPlan` enum('free','pro','enterprise') DEFAULT 'free',
	`subscriptionStatus` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
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
--> statement-breakpoint
CREATE INDEX `aal_user_idx` ON `admin_activity_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `aal_action_idx` ON `admin_activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `aal_category_idx` ON `admin_activity_logs` (`category`);--> statement-breakpoint
CREATE INDEX `aal_created_idx` ON `admin_activity_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_cache_key_idx` ON `ai_cache` (`cache_key`);--> statement-breakpoint
CREATE INDEX `ai_expires_at_idx` ON `ai_cache` (`expires_at`);--> statement-breakpoint
CREATE INDEX `acm_session_idx` ON `ai_chat_messages` (`sessionId`);--> statement-breakpoint
CREATE INDEX `acm_role_idx` ON `ai_chat_messages` (`role`);--> statement-breakpoint
CREATE INDEX `acs_user_idx` ON `ai_chat_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `acs_project_idx` ON `ai_chat_sessions` (`projectId`);--> statement-breakpoint
CREATE INDEX `adr_project_idx` ON `ai_decision_records` (`projectId`);--> statement-breakpoint
CREATE INDEX `adr_task_idx` ON `ai_decision_records` (`taskId`);--> statement-breakpoint
CREATE INDEX `adr_user_idx` ON `ai_decision_records` (`userId`);--> statement-breakpoint
CREATE INDEX `adr_status_idx` ON `ai_decision_records` (`status`);--> statement-breakpoint
CREATE INDEX `adr_type_idx` ON `ai_decision_records` (`decisionType`);--> statement-breakpoint
CREATE INDEX `ai_requests_user_id_idx` ON `ai_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_requests_session_id_idx` ON `ai_requests` (`session_id`);--> statement-breakpoint
CREATE INDEX `ai_sessions_user_id_idx` ON `ai_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_usage_user_date_idx` ON `ai_usage_stats` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `cl_role_idx` ON `credit_limits` (`roleId`);--> statement-breakpoint
CREATE INDEX `cl_user_idx` ON `credit_limits` (`userId`);--> statement-breakpoint
CREATE INDEX `et_slug_idx` ON `email_templates` (`slug`);--> statement-breakpoint
CREATE INDEX `er_source_idx` ON `entity_relations` (`sourceType`,`sourceId`);--> statement-breakpoint
CREATE INDEX `er_target_idx` ON `entity_relations` (`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `er_relation_type_idx` ON `entity_relations` (`relationType`);--> statement-breakpoint
CREATE INDEX `er_created_by_idx` ON `entity_relations` (`createdBy`);--> statement-breakpoint
CREATE INDEX `kc_view_config_idx` ON `kanban_columns` (`viewConfigId`);--> statement-breakpoint
CREATE INDEX `kc_column_type_idx` ON `kanban_columns` (`columnType`);--> statement-breakpoint
CREATE INDEX `ls_key_locale_idx` ON `localization_strings` (`key`,`locale`);--> statement-breakpoint
CREATE INDEX `ls_context_idx` ON `localization_strings` (`context`);--> statement-breakpoint
CREATE INDEX `lf_entity_idx` ON `lookup_fields` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `lf_relation_type_idx` ON `lookup_fields` (`relationType`);--> statement-breakpoint
CREATE INDEX `mc_user_idx` ON `model_comparisons` (`userId`);--> statement-breakpoint
CREATE INDEX `mc_created_idx` ON `model_comparisons` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ni_order_idx` ON `navbar_items` (`displayOrder`);--> statement-breakpoint
CREATE INDEX `pak_provider_idx` ON `platform_api_keys` (`provider`);--> statement-breakpoint
CREATE INDEX `user_idx` ON `projects` (`userId`);--> statement-breakpoint
CREATE INDEX `project_status_idx` ON `projects` (`status`);--> statement-breakpoint
CREATE INDEX `pv_prompt_idx` ON `prompt_versions` (`promptId`);--> statement-breakpoint
CREATE INDEX `pv_version_idx` ON `prompt_versions` (`version`);--> statement-breakpoint
CREATE INDEX `rf_entity_idx` ON `rollup_fields` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `rf_source_relation_idx` ON `rollup_fields` (`sourceRelationType`);--> statement-breakpoint
CREATE INDEX `sa_type_idx` ON `system_alerts` (`type`);--> statement-breakpoint
CREATE INDEX `sa_severity_idx` ON `system_alerts` (`severity`);--> statement-breakpoint
CREATE INDEX `sa_resolved_idx` ON `system_alerts` (`isResolved`);--> statement-breakpoint
CREATE INDEX `sp_slug_idx` ON `system_prompts` (`slug`);--> statement-breakpoint
CREATE INDEX `sp_category_idx` ON `system_prompts` (`category`);--> statement-breakpoint
CREATE INDEX `tags_project_idx` ON `tags` (`projectId`);--> statement-breakpoint
CREATE INDEX `tags_user_idx` ON `tags` (`userId`);--> statement-breakpoint
CREATE INDEX `tags_name_idx` ON `tags` (`name`);--> statement-breakpoint
CREATE INDEX `tags_type_idx` ON `tags` (`tagType`);--> statement-breakpoint
CREATE INDEX `tt_task_idx` ON `task_tags` (`taskId`);--> statement-breakpoint
CREATE INDEX `tt_tag_idx` ON `task_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `section_idx` ON `tasks` (`sectionId`);--> statement-breakpoint
CREATE INDEX `status_idx` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `deadline_idx` ON `tasks` (`deadline`);--> statement-breakpoint
CREATE INDEX `assigned_to_idx` ON `tasks` (`assignedTo`);--> statement-breakpoint
CREATE INDEX `te_user_idx` ON `time_entries` (`userId`);--> statement-breakpoint
CREATE INDEX `te_task_idx` ON `time_entries` (`taskId`);--> statement-breakpoint
CREATE INDEX `te_project_idx` ON `time_entries` (`projectId`);--> statement-breakpoint
CREATE INDEX `ua_user_idx` ON `user_achievements` (`userId`);--> statement-breakpoint
CREATE INDEX `ua_achievement_idx` ON `user_achievements` (`achievementId`);--> statement-breakpoint
CREATE INDEX `ual_user_idx` ON `user_activity_log` (`userId`);--> statement-breakpoint
CREATE INDEX `ual_action_idx` ON `user_activity_log` (`action`);--> statement-breakpoint
CREATE INDEX `ual_created_idx` ON `user_activity_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ui_email_idx` ON `user_invitations` (`email`);--> statement-breakpoint
CREATE INDEX `ui_token_idx` ON `user_invitations` (`token`);--> statement-breakpoint
CREATE INDEX `ui_status_idx` ON `user_invitations` (`status`);--> statement-breakpoint
CREATE INDEX `ura_user_idx` ON `user_role_assignments` (`userId`);--> statement-breakpoint
CREATE INDEX `ura_role_idx` ON `user_role_assignments` (`roleId`);--> statement-breakpoint
CREATE INDEX `vc_project_user_idx` ON `view_configs` (`projectId`,`userId`);--> statement-breakpoint
CREATE INDEX `vc_view_type_idx` ON `view_configs` (`viewType`);--> statement-breakpoint
CREATE INDEX `vc_is_default_idx` ON `view_configs` (`isDefault`);