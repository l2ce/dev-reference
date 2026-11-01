CREATE TABLE `article_protocols` (
	`article_id` text NOT NULL,
	`article_revision_id` text NOT NULL,
	`protocol_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`article_id`, `protocol_id`),
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`article_id`,`article_revision_id`) REFERENCES `article_revisions`(`article_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "article_protocols_position" CHECK("article_protocols"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `article_protocols_article_revision_id_position_unique` ON `article_protocols` (`article_revision_id`,`position`);

CREATE TABLE `article_revision_translations` (
	`article_revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`article_revision_id`, `locale`),
	FOREIGN KEY (`article_revision_id`) REFERENCES `article_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "article_revision_translations_status" CHECK("article_revision_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "article_revision_translations_sources" CHECK(json_type("article_revision_translations"."sources_json") = 'array'),
	CONSTRAINT "article_revision_translations_questions" CHECK(json_type("article_revision_translations"."open_questions_json") = 'array'),
	CONSTRAINT "article_revision_translations_sources_json" CHECK(json_valid("article_revision_translations"."sources_json")),
	CONSTRAINT "article_revision_translations_questions_json" CHECK(json_valid("article_revision_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `article_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`article_id` text NOT NULL,
	`rev` integer NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "article_revisions_rev" CHECK("article_revisions"."rev" > 0 AND "article_revisions"."rev" <= 9007199254740991),
	CONSTRAINT "article_revisions_status" CHECK("article_revisions"."status" IN ('missing', 'partial', 'documented'))
) STRICT;

CREATE UNIQUE INDEX `article_revisions_article_id_id_unique` ON `article_revisions` (`article_id`,`id`);

CREATE UNIQUE INDEX `article_revisions_article_id_rev_unique` ON `article_revisions` (`article_id`,`rev`);

CREATE TABLE `article_servers` (
	`article_id` text NOT NULL,
	`server` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`article_id`, `server`),
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "article_server" CHECK("article_servers"."server" IN ('login', 'game')),
	CONSTRAINT "article_server_position" CHECK("article_servers"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `article_servers_article_id_position_unique` ON `article_servers` (`article_id`,`position`);

CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer
) STRICT;

CREATE UNIQUE INDEX `articles_code_unique` ON `articles` (`code`);

CREATE TABLE `branch_translations` (
	`branch_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`branch_id`, `locale`),
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "branch_translations_status" CHECK("branch_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "branch_translations_sources" CHECK(json_type("branch_translations"."sources_json") = 'array'),
	CONSTRAINT "branch_translations_questions" CHECK(json_type("branch_translations"."open_questions_json") = 'array'),
	CONSTRAINT "branch_translations_sources_json" CHECK(json_valid("branch_translations"."sources_json")),
	CONSTRAINT "branch_translations_questions_json" CHECK(json_valid("branch_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `branches` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer
) STRICT;

CREATE UNIQUE INDEX `branches_code_unique` ON `branches` (`code`);

CREATE TABLE `chronicle_release_protocols` (
	`chronicle_release_id` text NOT NULL,
	`protocol_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`chronicle_release_id`, `protocol_id`),
	FOREIGN KEY (`chronicle_release_id`) REFERENCES `chronicle_releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "release_protocol_position" CHECK("chronicle_release_protocols"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `chronicle_release_protocols_chronicle_release_id_position_unique` ON `chronicle_release_protocols` (`chronicle_release_id`,`position`);

CREATE TABLE `chronicle_release_translations` (
	`chronicle_release_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`chronicle_release_id`, `locale`),
	FOREIGN KEY (`chronicle_release_id`) REFERENCES `chronicle_releases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chronicle_release_translations_status" CHECK("chronicle_release_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "chronicle_release_translations_sources" CHECK(json_type("chronicle_release_translations"."sources_json") = 'array'),
	CONSTRAINT "chronicle_release_translations_questions" CHECK(json_type("chronicle_release_translations"."open_questions_json") = 'array'),
	CONSTRAINT "chronicle_release_translations_sources_json" CHECK(json_valid("chronicle_release_translations"."sources_json")),
	CONSTRAINT "chronicle_release_translations_questions_json" CHECK(json_valid("chronicle_release_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `chronicle_releases` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer,
	`status` text NOT NULL,
	`chronicle_id` text NOT NULL,
	FOREIGN KEY (`chronicle_id`) REFERENCES `chronicles`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "release_status" CHECK("chronicle_releases"."status" IN ('missing', 'partial', 'documented'))
) STRICT;

CREATE UNIQUE INDEX `chronicle_releases_chronicle_id_code_unique` ON `chronicle_releases` (`chronicle_id`,`code`);

CREATE TABLE `chronicle_translations` (
	`chronicle_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`chronicle_id`, `locale`),
	FOREIGN KEY (`chronicle_id`) REFERENCES `chronicles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chronicle_translations_status" CHECK("chronicle_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "chronicle_translations_sources" CHECK(json_type("chronicle_translations"."sources_json") = 'array'),
	CONSTRAINT "chronicle_translations_questions" CHECK(json_type("chronicle_translations"."open_questions_json") = 'array'),
	CONSTRAINT "chronicle_translations_sources_json" CHECK(json_valid("chronicle_translations"."sources_json")),
	CONSTRAINT "chronicle_translations_questions_json" CHECK(json_valid("chronicle_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `chronicles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer,
	`branch_id` text NOT NULL,
	FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON UPDATE no action ON DELETE no action
) STRICT;

CREATE UNIQUE INDEX `chronicles_code_unique` ON `chronicles` (`code`);

CREATE TABLE `locales` (
	`code` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "locale_position" CHECK("locales"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `locales_position_unique` ON `locales` (`position`);

CREATE TABLE `metadata` (
	`id` integer PRIMARY KEY NOT NULL,
	`schema_rev` integer NOT NULL,
	`data_version` text NOT NULL,
	`default_locale` text NOT NULL,
	FOREIGN KEY (`default_locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "metadata_singleton" CHECK("metadata"."id" = 1),
	CONSTRAINT "metadata_version" CHECK("metadata"."schema_rev" = 19)
) STRICT;

CREATE TABLE `packet_protocols` (
	`packet_id` text NOT NULL,
	`packet_revision_id` text NOT NULL,
	`protocol_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`packet_id`, `protocol_id`),
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`packet_id`,`packet_revision_id`) REFERENCES `packet_revisions`(`packet_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "packet_protocols_position" CHECK("packet_protocols"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `packet_protocols_packet_revision_id_position_unique` ON `packet_protocols` (`packet_revision_id`,`position`);

CREATE TABLE `packet_revision_opcodes` (
	`packet_revision_id` text NOT NULL,
	`position` integer NOT NULL,
	`type` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`packet_revision_id`, `position`),
	FOREIGN KEY (`packet_revision_id`) REFERENCES `packet_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "opcode_position" CHECK("packet_revision_opcodes"."position" >= 0 AND "packet_revision_opcodes"."position" < 8),
	CONSTRAINT "opcode_value" CHECK("packet_revision_opcodes"."value" >= 0 AND (("packet_revision_opcodes"."type" = 'u8' AND "packet_revision_opcodes"."value" <= 255) OR ("packet_revision_opcodes"."type" = 'u16le' AND "packet_revision_opcodes"."value" <= 65535) OR ("packet_revision_opcodes"."type" = 'u32le' AND "packet_revision_opcodes"."value" <= 4294967295)))
) STRICT;

CREATE TABLE `packet_revision_states` (
	`packet_revision_id` text NOT NULL,
	`state` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`packet_revision_id`, `state`),
	FOREIGN KEY (`packet_revision_id`) REFERENCES `packet_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "state_text" CHECK(length(trim("packet_revision_states"."state")) > 0),
	CONSTRAINT "state_position" CHECK("packet_revision_states"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `packet_revision_states_packet_revision_id_position_unique` ON `packet_revision_states` (`packet_revision_id`,`position`);

CREATE TABLE `packet_revision_translations` (
	`packet_revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`packet_revision_id`, `locale`),
	FOREIGN KEY (`packet_revision_id`) REFERENCES `packet_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packet_revision_translations_status" CHECK("packet_revision_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "packet_revision_translations_sources" CHECK(json_type("packet_revision_translations"."sources_json") = 'array'),
	CONSTRAINT "packet_revision_translations_questions" CHECK(json_type("packet_revision_translations"."open_questions_json") = 'array'),
	CONSTRAINT "packet_revision_translations_sources_json" CHECK(json_valid("packet_revision_translations"."sources_json")),
	CONSTRAINT "packet_revision_translations_questions_json" CHECK(json_valid("packet_revision_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `packet_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`packet_id` text NOT NULL,
	`rev` integer NOT NULL,
	FOREIGN KEY (`packet_id`) REFERENCES `packets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "packet_revisions_rev" CHECK("packet_revisions"."rev" > 0 AND "packet_revisions"."rev" <= 9007199254740991),
	CONSTRAINT "packet_revisions_status" CHECK("packet_revisions"."status" IN ('missing', 'partial', 'documented'))
) STRICT;

CREATE UNIQUE INDEX `packet_revisions_packet_id_id_unique` ON `packet_revisions` (`packet_id`,`id`);

CREATE UNIQUE INDEX `packet_revisions_packet_id_rev_unique` ON `packet_revisions` (`packet_id`,`rev`);

CREATE TABLE `packets` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer,
	`name` text NOT NULL,
	`server` text NOT NULL,
	`direction` text NOT NULL,
	CONSTRAINT "packet_server" CHECK("packets"."server" IN ('login', 'game')),
	CONSTRAINT "packet_direction" CHECK("packets"."direction" IN ('client-to-server', 'server-to-client'))
) STRICT;

CREATE UNIQUE INDEX `packets_code_unique` ON `packets` (`code`);

CREATE TABLE `protocol_login_revisions` (
	`protocol_id` text NOT NULL,
	`number` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`protocol_id`, `number`),
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "login_number" CHECK("protocol_login_revisions"."number" >= 0 AND "protocol_login_revisions"."number" <= 9007199254740991),
	CONSTRAINT "login_position" CHECK("protocol_login_revisions"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `protocol_login_revisions_protocol_id_position_unique` ON `protocol_login_revisions` (`protocol_id`,`position`);

CREATE TABLE `protocol_regions` (
	`protocol_id` text NOT NULL,
	`region` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`protocol_id`, `region`),
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "region_text" CHECK(length(trim("protocol_regions"."region")) > 0),
	CONSTRAINT "region_position" CHECK("protocol_regions"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `protocol_regions_protocol_id_position_unique` ON `protocol_regions` (`protocol_id`,`position`);

CREATE TABLE `protocol_translations` (
	`protocol_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`protocol_id`, `locale`),
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "protocol_translations_status" CHECK("protocol_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "protocol_translations_sources" CHECK(json_type("protocol_translations"."sources_json") = 'array'),
	CONSTRAINT "protocol_translations_questions" CHECK(json_type("protocol_translations"."open_questions_json") = 'array'),
	CONSTRAINT "protocol_translations_sources_json" CHECK(json_valid("protocol_translations"."sources_json")),
	CONSTRAINT "protocol_translations_questions_json" CHECK(json_valid("protocol_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `protocols` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`number` integer NOT NULL,
	`variant` integer NOT NULL,
	CONSTRAINT "protocol_number" CHECK("protocols"."number" >= 0 AND "protocols"."number" <= 9007199254740991),
	CONSTRAINT "protocol_variant" CHECK("protocols"."variant" >= 0 AND "protocols"."variant" <= 9007199254740991),
	CONSTRAINT "protocol_status" CHECK("protocols"."status" IN ('missing', 'partial', 'documented'))
) STRICT;

CREATE UNIQUE INDEX `protocols_number_variant_unique` ON `protocols` (`number`,`variant`);

CREATE TABLE `scenario_protocols` (
	`scenario_id` text NOT NULL,
	`scenario_revision_id` text NOT NULL,
	`protocol_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`scenario_id`, `protocol_id`),
	FOREIGN KEY (`protocol_id`) REFERENCES `protocols`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`scenario_id`,`scenario_revision_id`) REFERENCES `scenario_revisions`(`scenario_id`,`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "scenario_protocols_position" CHECK("scenario_protocols"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `scenario_protocols_scenario_revision_id_position_unique` ON `scenario_protocols` (`scenario_revision_id`,`position`);

CREATE TABLE `scenario_revision_translations` (
	`scenario_revision_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`description` text NOT NULL,
	`sources_json` text NOT NULL,
	`translation_status` text NOT NULL,
	`open_questions_json` text NOT NULL,
	PRIMARY KEY(`scenario_revision_id`, `locale`),
	FOREIGN KEY (`scenario_revision_id`) REFERENCES `scenario_revisions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`locale`) REFERENCES `locales`(`code`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scenario_revision_translations_status" CHECK("scenario_revision_translations"."translation_status" IN ('ready', 'missing', 'outdated')),
	CONSTRAINT "scenario_revision_translations_sources" CHECK(json_type("scenario_revision_translations"."sources_json") = 'array'),
	CONSTRAINT "scenario_revision_translations_questions" CHECK(json_type("scenario_revision_translations"."open_questions_json") = 'array'),
	CONSTRAINT "scenario_revision_translations_sources_json" CHECK(json_valid("scenario_revision_translations"."sources_json")),
	CONSTRAINT "scenario_revision_translations_questions_json" CHECK(json_valid("scenario_revision_translations"."open_questions_json"))
) STRICT;

CREATE TABLE `scenario_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`scenario_id` text NOT NULL,
	`rev` integer NOT NULL,
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "scenario_revisions_rev" CHECK("scenario_revisions"."rev" > 0 AND "scenario_revisions"."rev" <= 9007199254740991),
	CONSTRAINT "scenario_revisions_status" CHECK("scenario_revisions"."status" IN ('missing', 'partial', 'documented'))
) STRICT;

CREATE UNIQUE INDEX `scenario_revisions_scenario_id_id_unique` ON `scenario_revisions` (`scenario_id`,`id`);

CREATE UNIQUE INDEX `scenario_revisions_scenario_id_rev_unique` ON `scenario_revisions` (`scenario_id`,`rev`);

CREATE TABLE `scenario_servers` (
	`scenario_id` text NOT NULL,
	`server` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`scenario_id`, `server`),
	FOREIGN KEY (`scenario_id`) REFERENCES `scenarios`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "scenario_server" CHECK("scenario_servers"."server" IN ('login', 'game')),
	CONSTRAINT "scenario_server_position" CHECK("scenario_servers"."position" >= 0)
) STRICT;

CREATE UNIQUE INDEX `scenario_servers_scenario_id_position_unique` ON `scenario_servers` (`scenario_id`,`position`);

CREATE TABLE `scenarios` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`sort_order` integer
) STRICT;

CREATE UNIQUE INDEX `scenarios_code_unique` ON `scenarios` (`code`);
