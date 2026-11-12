CREATE TABLE `quiz_answers` (
	`id` text PRIMARY KEY NOT NULL,
	`attempt_id` text NOT NULL,
	`question_id` text NOT NULL,
	`response_json` text NOT NULL,
	`is_correct` integer NOT NULL,
	FOREIGN KEY (`attempt_id`) REFERENCES `quiz_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_answers_attempt_idx` ON `quiz_answers` (`attempt_id`);--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`topic_id` text NOT NULL,
	`score` integer NOT NULL,
	`total` integer NOT NULL,
	`submitted_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`topic_id`) REFERENCES `topics`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `quiz_attempts_topic_idx` ON `quiz_attempts` (`topic_id`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `assignment` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `completed_at` integer;