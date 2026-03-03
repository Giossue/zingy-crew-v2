CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'scheduled', 'sent', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."code_status" AS ENUM('unused', 'used', 'expired');--> statement-breakpoint
CREATE TYPE "public"."point_transaction_reason" AS ENUM('purchase', 'admin_assigned', 'redemption_in_reward', 'referral_bonus', 'campaign_gift', 'refund', 'code_claim', 'birthday_bonus', 'registration_bonus');--> statement-breakpoint
CREATE TYPE "public"."redemption_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reward_status" AS ENUM('active', 'inactive', 'out_of_stock');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('pending', 'success', 'failed');--> statement-breakpoint
CREATE TABLE "admin_notifications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" bigint,
	"type" varchar(50) NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100),
	"last_name" varchar(100),
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"admin_id" bigint,
	"action_type" varchar(50) NOT NULL,
	"table_name" varchar(100) NOT NULL,
	"target_id" bigint NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_attempts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"attempt_type" varchar(20) NOT NULL,
	"success" boolean DEFAULT false NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "burned_contacts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"contact_type" varchar(20) NOT NULL,
	"contact_value" varchar(255) NOT NULL,
	"burned_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "burned_contacts_contact_value_unique" UNIQUE("contact_value"),
	CONSTRAINT "chk_burned_contact_type" CHECK ("burned_contacts"."contact_type" IN ('email', 'phone'))
);
--> statement-breakpoint
CREATE TABLE "campaigns_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"image_url" varchar(500),
	"channels" text[] DEFAULT ARRAY['app'] NOT NULL,
	"target_criteria" jsonb,
	"points_gifted" integer DEFAULT 0 NOT NULL,
	"recipients_count" integer DEFAULT 0 NOT NULL,
	"scheduled_at" timestamp,
	"sent_at" timestamp,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_campaign_counts_non_negative" CHECK ("campaigns_history"."points_gifted" >= 0 AND "campaigns_history"."recipients_count" >= 0),
	CONSTRAINT "chk_campaign_status" CHECK ("campaigns_history"."status" IN ('draft', 'scheduled', 'sent', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "client_group_members" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"group_id" bigint NOT NULL,
	"client_id" bigint NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_groups" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"id_referral" varchar(36),
	"phone" varchar(20) NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"avatar_svg" varchar(100) DEFAULT 'default.svg' NOT NULL,
	"birth_date" date,
	"points" bigint DEFAULT 0 NOT NULL,
	"lifetime_points" bigint DEFAULT 0 NOT NULL,
	"current_tier_id" bigint,
	"username_last_changed_at" timestamp,
	"wants_marketing_email" boolean DEFAULT false NOT NULL,
	"wants_marketing_whatsapp" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"last_login_at" timestamp,
	"login_count" integer DEFAULT 0 NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"block_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clients_id_referral_unique" UNIQUE("id_referral"),
	CONSTRAINT "clients_phone_unique" UNIQUE("phone"),
	CONSTRAINT "clients_email_unique" UNIQUE("email"),
	CONSTRAINT "clients_username_unique" UNIQUE("username"),
	CONSTRAINT "chk_points_non_negative" CHECK ("clients"."points" >= 0 AND "clients"."lifetime_points" >= 0),
	CONSTRAINT "chk_phone_format" CHECK ("clients"."phone" ~ '^+?[0-9s-()]{7,20}$'),
	CONSTRAINT "chk_login_count_non_negative" CHECK ("clients"."login_count" >= 0),
	CONSTRAINT "chk_age_range" CHECK ("clients"."birth_date" IS NULL OR (
        AGE("clients"."birth_date") >= INTERVAL '14 years' AND 
        AGE("clients"."birth_date") <= INTERVAL '100 years'
      ))
);
--> statement-breakpoint
CREATE TABLE "codes" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"status" "code_status" DEFAULT 'unused' NOT NULL,
	"points_value" integer NOT NULL,
	"batch_name" varchar(100) NOT NULL,
	"expiration_date" timestamp NOT NULL,
	"used_at" timestamp,
	"used_by" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "codes_code_unique" UNIQUE("code"),
	CONSTRAINT "chk_points_value_positive" CHECK ("codes"."points_value" > 0),
	CONSTRAINT "chk_code_format" CHECK ("codes"."code" ~ '^[A-Z0-9-]+$')
);
--> statement-breakpoint
CREATE TABLE "gdpr_erasure_requests" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" bigint NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"executed_at" timestamp,
	"executed_by_admin_id" bigint,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"reason" text,
	CONSTRAINT "chk_gdpr_erasure_status" CHECK ("gdpr_erasure_requests"."status" IN ('pending', 'executed', 'rejected'))
);
--> statement-breakpoint
CREATE TABLE "name_changes_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" bigint NOT NULL,
	"old_names" text[] NOT NULL,
	"new_name" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "point_transactions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" bigint NOT NULL,
	"amount" bigint NOT NULL,
	"reason" "point_transaction_reason" NOT NULL,
	"reference_id" bigint,
	"reference_type" varchar(50),
	"balance_after" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_admin_id" bigint,
	CONSTRAINT "chk_transaction_amount_not_zero" CHECK ("point_transactions"."amount" != 0),
	CONSTRAINT "chk_transaction_reference_pair" CHECK (("point_transactions"."reference_id" IS NULL AND "point_transactions"."reference_type" IS NULL)
        OR ("point_transactions"."reference_id" IS NOT NULL AND "point_transactions"."reference_type" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"client_id" bigint NOT NULL,
	"reward_id" bigint NOT NULL,
	"ticket_uuid" varchar(36) DEFAULT uuid_generate_v4() NOT NULL,
	"points_spent" integer NOT NULL,
	"status" "redemption_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"reviewed_by_admin_id" bigint,
	"rejection_reason" varchar(100),
	"rejection_reason_custom" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "redemptions_ticket_uuid_unique" UNIQUE("ticket_uuid"),
	CONSTRAINT "chk_points_spent_positive" CHECK ("redemptions"."points_spent" > 0)
);
--> statement-breakpoint
CREATE TABLE "referral_blocks" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"required_referrals" integer NOT NULL,
	"points_reward" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_required_referrals_positive" CHECK ("referral_blocks"."required_referrals" > 0),
	CONSTRAINT "chk_points_reward_positive" CHECK ("referral_blocks"."points_reward" > 0)
);
--> statement-breakpoint
CREATE TABLE "referral_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"referrer_id" bigint NOT NULL,
	"referred_id" bigint NOT NULL,
	"counted_for_block_id" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_referral_not_self" CHECK ("referral_history"."referrer_id" != "referral_history"."referred_id")
);
--> statement-breakpoint
CREATE TABLE "referral_progress" (
	"client_id" bigint NOT NULL,
	"block_id" bigint NOT NULL,
	"referrals_count" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "referral_progress_client_id_block_id_pk" PRIMARY KEY("client_id","block_id"),
	CONSTRAINT "chk_referrals_count_non_negative" CHECK ("referral_progress"."referrals_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "reward_categories" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reward_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "rewards" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"image_url" text[] DEFAULT '{}',
	"points_required" integer NOT NULL,
	"tier_id" bigint,
	"category_id" bigint,
	"status" "reward_status" DEFAULT 'active' NOT NULL,
	"stock" integer,
	"display_order" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_points_required_positive" CHECK ("rewards"."points_required" > 0),
	CONSTRAINT "chk_stock_non_negative" CHECK ("rewards"."stock" IS NULL OR "rewards"."stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tiers" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"points_required" integer DEFAULT 0 NOT NULL,
	"benefits" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tiers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "webhook_delivery_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"webhook_event_id" bigint,
	"event_type" varchar(50) NOT NULL,
	"url" varchar(500) NOT NULL,
	"payload" jsonb NOT NULL,
	"delivery_status" "webhook_delivery_status" DEFAULT 'pending' NOT NULL,
	"status_code" integer,
	"response" text,
	"intent_count" integer DEFAULT 1 NOT NULL,
	"error_message" text,
	"next_retry_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_webhook_delivery_status" CHECK ("webhook_delivery_logs"."delivery_status" IN ('pending', 'success', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"is_post_event" boolean DEFAULT true NOT NULL,
	"is_gethook" boolean DEFAULT false NOT NULL,
	"event_name" varchar(100) NOT NULL,
	"description" text,
	"webhook_url" varchar(500),
	"secret_hash" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"payload_template" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_event_name_unique" UNIQUE("event_name"),
	CONSTRAINT "chk_webhook_url_format" CHECK ("webhook_events"."webhook_url" IS NULL OR "webhook_events"."webhook_url" ~ '^https?://')
);
--> statement-breakpoint
ALTER TABLE "admin_notifications" ADD CONSTRAINT "admin_notifications_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_group_id_client_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."client_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_group_members" ADD CONSTRAINT "client_group_members_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "fk_clients_current_tier" FOREIGN KEY ("current_tier_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "codes" ADD CONSTRAINT "codes_used_by_clients_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_erasure_requests" ADD CONSTRAINT "gdpr_erasure_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gdpr_erasure_requests" ADD CONSTRAINT "gdpr_erasure_requests_executed_by_admin_id_admins_id_fk" FOREIGN KEY ("executed_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "name_changes_history" ADD CONSTRAINT "name_changes_history_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_created_by_admin_id_admins_id_fk" FOREIGN KEY ("created_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reward_id_rewards_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."rewards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_reviewed_by_admin_id_admins_id_fk" FOREIGN KEY ("reviewed_by_admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_history" ADD CONSTRAINT "referral_history_referrer_id_clients_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_history" ADD CONSTRAINT "referral_history_referred_id_clients_id_fk" FOREIGN KEY ("referred_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_history" ADD CONSTRAINT "referral_history_counted_for_block_id_referral_blocks_id_fk" FOREIGN KEY ("counted_for_block_id") REFERENCES "public"."referral_blocks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_progress" ADD CONSTRAINT "referral_progress_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_progress" ADD CONSTRAINT "referral_progress_block_id_referral_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."referral_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_tier_id_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."tiers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rewards" ADD CONSTRAINT "rewards_category_id_reward_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."reward_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_delivery_logs" ADD CONSTRAINT "webhook_delivery_logs_webhook_event_id_webhook_events_id_fk" FOREIGN KEY ("webhook_event_id") REFERENCES "public"."webhook_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admin_notifications_admin_id" ON "admin_notifications" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_admin_notifications_is_read" ON "admin_notifications" USING btree ("is_read");--> statement-breakpoint
CREATE INDEX "idx_admins_email" ON "admins" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_table_target" ON "audit_logs" USING btree ("table_name","target_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_admin_id" ON "audit_logs" USING btree ("admin_id");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_system_retention" ON "audit_logs" USING btree ("created_at") WHERE "audit_logs"."admin_id" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_auth_attempts_identifier_type" ON "auth_attempts" USING btree ("identifier","attempt_type");--> statement-breakpoint
CREATE INDEX "idx_auth_attempts_created_at" ON "auth_attempts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_burned_contacts_value" ON "burned_contacts" USING btree ("contact_value");--> statement-breakpoint
CREATE INDEX "idx_campaigns_history_created_at" ON "campaigns_history" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_campaigns_history_status" ON "campaigns_history" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_campaigns_history_target_criteria_gin" ON "campaigns_history" USING gin ("target_criteria");--> statement-breakpoint
CREATE UNIQUE INDEX "uk_group_member" ON "client_group_members" USING btree ("group_id","client_id");--> statement-breakpoint
CREATE INDEX "idx_client_group_members_group_id" ON "client_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_client_group_members_client_id" ON "client_group_members" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_client_groups_deleted_at" ON "client_groups" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_clients_phone" ON "clients" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "idx_clients_email" ON "clients" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_clients_username" ON "clients" USING btree ("username");--> statement-breakpoint
CREATE INDEX "idx_clients_points" ON "clients" USING btree ("points");--> statement-breakpoint
CREATE INDEX "idx_clients_lifetime_points" ON "clients" USING btree ("lifetime_points");--> statement-breakpoint
CREATE INDEX "idx_clients_current_tier_id" ON "clients" USING btree ("current_tier_id");--> statement-breakpoint
CREATE INDEX "idx_clients_is_blocked" ON "clients" USING btree ("is_blocked");--> statement-breakpoint
CREATE INDEX "idx_clients_deleted_at" ON "clients" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "idx_clients_birth_date_month_day" ON "clients" USING btree (EXTRACT(MONTH FROM "birth_date"),EXTRACT(DAY FROM "birth_date"));--> statement-breakpoint
CREATE INDEX "idx_codes_batch_name" ON "codes" USING btree ("batch_name");--> statement-breakpoint
CREATE INDEX "idx_codes_status" ON "codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_codes_code" ON "codes" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_codes_expiration_date" ON "codes" USING btree ("expiration_date");--> statement-breakpoint
CREATE INDEX "idx_gdpr_erasure_requests_client_id" ON "gdpr_erasure_requests" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_gdpr_erasure_requests_status" ON "gdpr_erasure_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_point_transactions_client_id" ON "point_transactions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_point_transactions_reason" ON "point_transactions" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "idx_point_transactions_reference_type" ON "point_transactions" USING btree ("reference_type");--> statement-breakpoint
CREATE INDEX "idx_point_transactions_created_at" ON "point_transactions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_point_transactions_client_created" ON "point_transactions" USING btree ("client_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_point_transactions_reference_lookup" ON "point_transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "idx_redemptions_client_id" ON "redemptions" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_redemptions_reward_id" ON "redemptions" USING btree ("reward_id");--> statement-breakpoint
CREATE INDEX "idx_redemptions_status" ON "redemptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_redemptions_ticket_uuid" ON "redemptions" USING btree ("ticket_uuid");--> statement-breakpoint
CREATE INDEX "idx_redemptions_created_at" ON "redemptions" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_referral_blocks_is_active" ON "referral_blocks" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_referral_blocks_order" ON "referral_blocks" USING btree ("order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "uk_referral_pair" ON "referral_history" USING btree ("referrer_id","referred_id");--> statement-breakpoint
CREATE INDEX "idx_referral_history_referrer_id" ON "referral_history" USING btree ("referrer_id");--> statement-breakpoint
CREATE INDEX "idx_referral_history_referred_id" ON "referral_history" USING btree ("referred_id");--> statement-breakpoint
CREATE INDEX "idx_referral_history_pair" ON "referral_history" USING btree ("referrer_id","referred_id");--> statement-breakpoint
CREATE INDEX "idx_referral_history_block_id" ON "referral_history" USING btree ("counted_for_block_id");--> statement-breakpoint
CREATE INDEX "idx_rewards_status" ON "rewards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_rewards_tier_id" ON "rewards" USING btree ("tier_id");--> statement-breakpoint
CREATE INDEX "idx_rewards_category_id" ON "rewards" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "idx_rewards_points_required" ON "rewards" USING btree ("points_required");--> statement-breakpoint
CREATE INDEX "idx_rewards_display_order" ON "rewards" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "idx_rewards_is_featured" ON "rewards" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "idx_tiers_points_required" ON "tiers" USING btree ("points_required");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_event_id" ON "webhook_delivery_logs" USING btree ("webhook_event_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_event_type" ON "webhook_delivery_logs" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_status_retry" ON "webhook_delivery_logs" USING btree ("delivery_status","next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_delivery_logs_next_retry" ON "webhook_delivery_logs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_is_active" ON "webhook_events" USING btree ("is_active");--> statement-breakpoint
CREATE VIEW "public"."v_client_summary" AS (select "clients"."id", "clients"."username", "clients"."phone", "clients"."points", "clients"."lifetime_points", "tiers"."name", "clients"."is_blocked", "clients"."last_login_at", "clients"."created_at" from "clients" left join "tiers" on "tiers"."id" = "clients"."current_tier_id" where "clients"."deleted_at" IS NULL);