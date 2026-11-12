ALTER TABLE `lessons` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `hero_query` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `core_concepts_json` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `comparison_json` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `real_world_json` text;--> statement-breakpoint
ALTER TABLE `questions` ADD `placement` text DEFAULT 'final' NOT NULL;