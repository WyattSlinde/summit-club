CREATE INDEX `idx_proposals_user_created` ON `proposals` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_votes_adventure` ON `votes` (`adventure_id`);