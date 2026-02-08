ALTER TABLE `comment_reactions` ADD CONSTRAINT `cr_unique_idx` UNIQUE(`commentId`,`userId`,`emoji`);--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `member_project_user_idx` UNIQUE(`projectId`,`userId`);--> statement-breakpoint
ALTER TABLE `template_ratings` ADD CONSTRAINT `tr_unique_idx` UNIQUE(`templateId`,`userId`);--> statement-breakpoint
ALTER TABLE `template_to_tags` ADD CONSTRAINT `ttt_unique_idx` UNIQUE(`templateId`,`tagId`);--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_history` ADD CONSTRAINT `ai_chat_history_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_history` ADD CONSTRAINT `ai_chat_history_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_session_fk` FOREIGN KEY (`sessionId`) REFERENCES `ai_chat_sessions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_messages` ADD CONSTRAINT `ai_chat_messages_decision_record_fk` FOREIGN KEY (`decisionRecordId`) REFERENCES `ai_decision_records`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_chat_sessions` ADD CONSTRAINT `ai_chat_sessions_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_decision_records` ADD CONSTRAINT `ai_decision_records_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_decision_records` ADD CONSTRAINT `ai_decision_records_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_integrations` ADD CONSTRAINT `ai_integrations_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_preferences` ADD CONSTRAINT `ai_preferences_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_requests` ADD CONSTRAINT `ai_requests_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_sessions` ADD CONSTRAINT `ai_sessions_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_settings` ADD CONSTRAINT `ai_settings_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD CONSTRAINT `ai_suggestions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD CONSTRAINT `ai_suggestions_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_suggestions` ADD CONSTRAINT `ai_suggestions_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_usage_stats` ADD CONSTRAINT `ai_usage_stats_user_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_usage_tracking` ADD CONSTRAINT `ai_usage_tracking_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `api_usage` ADD CONSTRAINT `api_usage_api_key_fk` FOREIGN KEY (`apiKeyId`) REFERENCES `api_keys`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `blocks` ADD CONSTRAINT `blocks_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chat_messages` ADD CONSTRAINT `chat_messages_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_comment_fk` FOREIGN KEY (`commentId`) REFERENCES `task_comments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comment_reactions` ADD CONSTRAINT `comment_reactions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `credit_transactions` ADD CONSTRAINT `credit_transactions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `email_digest_queue` ADD CONSTRAINT `email_digest_queue_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `entity_relations` ADD CONSTRAINT `entity_relations_created_by_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executive_summaries` ADD CONSTRAINT `executive_summaries_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executive_summaries` ADD CONSTRAINT `executive_summaries_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kanban_columns` ADD CONSTRAINT `kanban_columns_view_config_fk` FOREIGN KEY (`viewConfigId`) REFERENCES `view_configs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lookup_fields` ADD CONSTRAINT `lookup_fields_created_by_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notification_preferences` ADD CONSTRAINT `notification_preferences_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pitch_decks` ADD CONSTRAINT `pitch_decks_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pitch_decks` ADD CONSTRAINT `pitch_decks_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD CONSTRAINT `project_invitations_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_invitations` ADD CONSTRAINT `project_invitations_invited_by_fk` FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_members` ADD CONSTRAINT `project_members_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_risks` ADD CONSTRAINT `project_risks_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_risks` ADD CONSTRAINT `project_risks_block_fk` FOREIGN KEY (`blockId`) REFERENCES `blocks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_risks` ADD CONSTRAINT `project_risks_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_templates` ADD CONSTRAINT `project_templates_author_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_templates` ADD CONSTRAINT `project_templates_category_fk` FOREIGN KEY (`categoryId`) REFERENCES `template_categories`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rollup_fields` ADD CONSTRAINT `rollup_fields_created_by_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_block_fk` FOREIGN KEY (`blockId`) REFERENCES `blocks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subtask_template_items` ADD CONSTRAINT `subtask_template_items_template_fk` FOREIGN KEY (`templateId`) REFERENCES `subtask_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subtask_templates` ADD CONSTRAINT `subtask_templates_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subtasks` ADD CONSTRAINT `subtasks_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tags` ADD CONSTRAINT `tags_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tags` ADD CONSTRAINT `tags_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_comments` ADD CONSTRAINT `task_comments_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_tags` ADD CONSTRAINT `task_tags_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_tags` ADD CONSTRAINT `task_tags_tag_fk` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_tags` ADD CONSTRAINT `task_tags_added_by_fk` FOREIGN KEY (`addedBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_section_fk` FOREIGN KEY (`sectionId`) REFERENCES `sections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigned_to_fk` FOREIGN KEY (`assignedTo`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_downloads` ADD CONSTRAINT `template_downloads_template_fk` FOREIGN KEY (`templateId`) REFERENCES `project_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_downloads` ADD CONSTRAINT `template_downloads_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_downloads` ADD CONSTRAINT `template_downloads_project_fk` FOREIGN KEY (`createdProjectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_ratings` ADD CONSTRAINT `template_ratings_template_fk` FOREIGN KEY (`templateId`) REFERENCES `project_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_ratings` ADD CONSTRAINT `template_ratings_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_to_tags` ADD CONSTRAINT `template_to_tags_template_fk` FOREIGN KEY (`templateId`) REFERENCES `project_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_to_tags` ADD CONSTRAINT `template_to_tags_tag_fk` FOREIGN KEY (`tagId`) REFERENCES `template_tags`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_task_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_goals` ADD CONSTRAINT `time_goals_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_goals` ADD CONSTRAINT `time_goals_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_achievements` ADD CONSTRAINT `user_achievements_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_achievements` ADD CONSTRAINT `user_achievements_achievement_fk` FOREIGN KEY (`achievementId`) REFERENCES `achievement_definitions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_credits` ADD CONSTRAINT `user_credits_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_invitations` ADD CONSTRAINT `user_invitations_role_fk` FOREIGN KEY (`roleId`) REFERENCES `user_roles`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_invitations` ADD CONSTRAINT `user_invitations_invited_by_fk` FOREIGN KEY (`invitedBy`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_invitations` ADD CONSTRAINT `user_invitations_accepted_by_fk` FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_project_preferences` ADD CONSTRAINT `user_project_preferences_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_project_preferences` ADD CONSTRAINT `user_project_preferences_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_role_fk` FOREIGN KEY (`roleId`) REFERENCES `user_roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_role_assignments` ADD CONSTRAINT `user_role_assignments_assigned_by_fk` FOREIGN KEY (`assignedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_stats` ADD CONSTRAINT `user_stats_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_subscriptions` ADD CONSTRAINT `user_subscriptions_plan_fk` FOREIGN KEY (`planId`) REFERENCES `subscription_plans`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `view_configs` ADD CONSTRAINT `view_configs_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `view_configs` ADD CONSTRAINT `view_configs_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_fk` FOREIGN KEY (`webhookId`) REFERENCES `webhooks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_user_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `webhooks` ADD CONSTRAINT `webhooks_project_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `activity_project_idx` ON `activity_log` (`projectId`);--> statement-breakpoint
CREATE INDEX `activity_user_idx` ON `activity_log` (`userId`);--> statement-breakpoint
CREATE INDEX `activity_created_idx` ON `activity_log` (`createdAt`);--> statement-breakpoint
CREATE INDEX `aich_user_project_idx` ON `ai_chat_history` (`userId`,`projectId`);--> statement-breakpoint
CREATE INDEX `aich_task_idx` ON `ai_chat_history` (`taskId`);--> statement-breakpoint
CREATE INDEX `aich_created_idx` ON `ai_chat_history` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_int_user_idx` ON `ai_integrations` (`userId`);--> statement-breakpoint
CREATE INDEX `ai_settings_user_idx` ON `ai_settings` (`userId`);--> statement-breakpoint
CREATE INDEX `ais_user_idx` ON `ai_suggestions` (`userId`);--> statement-breakpoint
CREATE INDEX `ais_project_idx` ON `ai_suggestions` (`projectId`);--> statement-breakpoint
CREATE INDEX `ais_task_idx` ON `ai_suggestions` (`taskId`);--> statement-breakpoint
CREATE INDEX `aut_user_date_idx` ON `ai_usage_tracking` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `ak_user_idx` ON `api_keys` (`userId`);--> statement-breakpoint
CREATE INDEX `ak_key_hash_idx` ON `api_keys` (`keyHash`);--> statement-breakpoint
CREATE INDEX `au_api_key_idx` ON `api_usage` (`apiKeyId`);--> statement-breakpoint
CREATE INDEX `au_created_idx` ON `api_usage` (`createdAt`);--> statement-breakpoint
CREATE INDEX `block_project_sort_idx` ON `blocks` (`projectId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `chat_context_idx` ON `chat_messages` (`contextType`,`contextId`);--> statement-breakpoint
CREATE INDEX `chat_user_idx` ON `chat_messages` (`userId`);--> statement-breakpoint
CREATE INDEX `cr_comment_idx` ON `comment_reactions` (`commentId`);--> statement-breakpoint
CREATE INDEX `cr_user_idx` ON `comment_reactions` (`userId`);--> statement-breakpoint
CREATE INDEX `credit_user_idx` ON `credit_transactions` (`userId`);--> statement-breakpoint
CREATE INDEX `credit_created_idx` ON `credit_transactions` (`createdAt`);--> statement-breakpoint
CREATE INDEX `edq_status_scheduled_idx` ON `email_digest_queue` (`status`,`scheduledFor`);--> statement-breakpoint
CREATE INDEX `edq_user_idx` ON `email_digest_queue` (`userId`);--> statement-breakpoint
CREATE INDEX `es_project_idx` ON `executive_summaries` (`projectId`);--> statement-breakpoint
CREATE INDEX `es_user_idx` ON `executive_summaries` (`userId`);--> statement-breakpoint
CREATE INDEX `notification_user_read_idx` ON `notifications` (`userId`,`isRead`);--> statement-breakpoint
CREATE INDEX `notification_user_created_idx` ON `notifications` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `pd_user_idx` ON `pitch_decks` (`userId`);--> statement-breakpoint
CREATE INDEX `pd_project_idx` ON `pitch_decks` (`projectId`);--> statement-breakpoint
CREATE INDEX `invitation_project_idx` ON `project_invitations` (`projectId`);--> statement-breakpoint
CREATE INDEX `invitation_invited_by_idx` ON `project_invitations` (`invitedBy`);--> statement-breakpoint
CREATE INDEX `member_user_idx` ON `project_members` (`userId`);--> statement-breakpoint
CREATE INDEX `pr_project_idx` ON `project_risks` (`projectId`);--> statement-breakpoint
CREATE INDEX `pr_status_idx` ON `project_risks` (`status`);--> statement-breakpoint
CREATE INDEX `pt_author_idx` ON `project_templates` (`authorId`);--> statement-breakpoint
CREATE INDEX `pt_category_idx` ON `project_templates` (`categoryId`);--> statement-breakpoint
CREATE INDEX `pt_is_public_idx` ON `project_templates` (`isPublic`);--> statement-breakpoint
CREATE INDEX `section_block_sort_idx` ON `sections` (`blockId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `sti_template_sort_idx` ON `subtask_template_items` (`templateId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `subtask_template_user_idx` ON `subtask_templates` (`userId`);--> statement-breakpoint
CREATE INDEX `subtask_task_sort_idx` ON `subtasks` (`taskId`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `tc_entity_idx` ON `task_comments` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `tc_user_idx` ON `task_comments` (`userId`);--> statement-breakpoint
CREATE INDEX `td_template_idx` ON `template_downloads` (`templateId`);--> statement-breakpoint
CREATE INDEX `td_user_idx` ON `template_downloads` (`userId`);--> statement-breakpoint
CREATE INDEX `tr_template_idx` ON `template_ratings` (`templateId`);--> statement-breakpoint
CREATE INDEX `tr_user_idx` ON `template_ratings` (`userId`);--> statement-breakpoint
CREATE INDEX `ttt_template_idx` ON `template_to_tags` (`templateId`);--> statement-breakpoint
CREATE INDEX `ttt_tag_idx` ON `template_to_tags` (`tagId`);--> statement-breakpoint
CREATE INDEX `tg_user_idx` ON `time_goals` (`userId`);--> statement-breakpoint
CREATE INDEX `tg_project_idx` ON `time_goals` (`projectId`);--> statement-breakpoint
CREATE INDEX `us_user_idx` ON `user_subscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `us_plan_idx` ON `user_subscriptions` (`planId`);--> statement-breakpoint
CREATE INDEX `us_status_idx` ON `user_subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `whd_webhook_idx` ON `webhook_deliveries` (`webhookId`);--> statement-breakpoint
CREATE INDEX `whd_created_idx` ON `webhook_deliveries` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wh_user_idx` ON `webhooks` (`userId`);--> statement-breakpoint
CREATE INDEX `wh_project_idx` ON `webhooks` (`projectId`);