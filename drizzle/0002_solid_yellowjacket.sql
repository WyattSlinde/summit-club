CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`starts_at` text NOT NULL,
	`location` text NOT NULL,
	`details` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `event_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_rsvps_event` ON `rsvps` (`event_id`);