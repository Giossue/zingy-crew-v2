// ============================================
// SCHEMA: Crew Zingy (Drizzle ORM - PostgreSQL)
// Traducción completa de schema.md v3.1.0
// ============================================

import {
    pgTable,
    pgEnum,
    pgView,
    bigserial,
    bigint,
    varchar,
    text,
    boolean,
    integer,
    timestamp,
    date,
    jsonb,
    inet,
    index,
    uniqueIndex,
    check,
    primaryKey,
    foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ============================================
// 1. ENUMS
// ============================================

export const rewardStatusEnum = pgEnum("reward_status", [
    "active",
    "inactive",
    "out_of_stock",
]);

export const redemptionStatusEnum = pgEnum("redemption_status", [
    "pending",
    "approved",
    "rejected",
]);

export const pointTransactionReasonEnum = pgEnum("point_transaction_reason", [
    "purchase",
    "admin_assigned",
    "redemption_in_reward",
    "referral_bonus",
    "campaign_gift",
    "refund",
    "code_claim",
    "birthday_bonus",
    "registration_bonus",
]);

export const codeStatusEnum = pgEnum("code_status", [
    "unused",
    "used",
    "expired",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
    "draft",
    "scheduled",
    "sent",
    "completed",
    "failed",
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
    "pending",
    "success",
    "failed",
]);

// ============================================
// 2. TABLAS - ADMINISTRACIÓN Y SEGURIDAD
// ============================================

export const admins = pgTable(
    "admins",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        email: varchar("email", { length: 255 }).notNull().unique(),
        passwordHash: varchar("password_hash", { length: 255 }).notNull(),
        firstName: varchar("first_name", { length: 100 }),
        lastName: varchar("last_name", { length: 100 }),
        lastLoginAt: timestamp("last_login_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        index("idx_admins_email").on(table.email),
    ]
);

export const burnedContacts = pgTable(
    "burned_contacts",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        contactType: varchar("contact_type", { length: 20 }).notNull(),
        contactValue: varchar("contact_value", { length: 255 }).notNull().unique(),
        burnedAt: timestamp("burned_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_burned_contact_type",
            sql`${table.contactType} IN ('email', 'phone')`
        ),
        index("idx_burned_contacts_value").on(table.contactValue),
    ]
);

export const auditLogs = pgTable(
    "audit_logs",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        adminId: bigint("admin_id", { mode: "number" }).references(() => admins.id, {
            onDelete: "set null",
        }),
        actionType: varchar("action_type", { length: 50 }).notNull(),
        tableName: varchar("table_name", { length: 100 }).notNull(),
        targetId: bigint("target_id", { mode: "number" }).notNull(),
        oldValues: jsonb("old_values"),
        newValues: jsonb("new_values"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("idx_audit_logs_table_target").on(table.tableName, table.targetId),
        index("idx_audit_logs_admin_id").on(table.adminId),
        index("idx_audit_logs_created_at").on(table.createdAt),
        index("idx_audit_logs_system_retention")
            .on(table.createdAt)
            .where(sql`${table.adminId} IS NULL`),
    ]
);

export const authAttempts = pgTable(
    "auth_attempts",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        identifier: varchar("identifier", { length: 255 }).notNull(),
        attemptType: varchar("attempt_type", { length: 20 }).notNull(),
        success: boolean("success").notNull().default(false),
        ipAddress: inet("ip_address"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("idx_auth_attempts_identifier_type").on(
            table.identifier,
            table.attemptType
        ),
        index("idx_auth_attempts_created_at").on(table.createdAt),
    ]
);

// ============================================
// 3. TABLAS - CATÁLOGO DINÁMICO (definidas antes de clients por FK)
// ============================================

export const tiers = pgTable(
    "tiers",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        name: varchar("name", { length: 100 }).notNull().unique(),
        description: text("description"),
        pointsRequired: integer("points_required").notNull().default(0),
        benefits: jsonb("benefits").default(sql`'[]'::jsonb`),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        index("idx_tiers_points_required").on(table.pointsRequired),
    ]
);

// ============================================
// 4. TABLAS - CLIENTES Y NEGOCIO
// ============================================

export const clients = pgTable(
    "clients",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        idReferral: varchar("id_referral", { length: 36 }).unique(),
        phone: varchar("phone", { length: 20 }).notNull().unique(),
        email: varchar("email", { length: 255 }).notNull().unique(),
        username: varchar("username", { length: 50 }).notNull().unique(),
        passwordHash: varchar("password_hash", { length: 255 }).notNull(),
        avatarSvg: varchar("avatar_svg", { length: 100 })
            .notNull()
            .default("default.svg"),
        birthDate: date("birth_date"),
        points: bigint("points", { mode: "number" }).notNull().default(0),
        lifetimePoints: bigint("lifetime_points", { mode: "number" })
            .notNull()
            .default(0),
        currentTierId: bigint("current_tier_id", { mode: "number" }),
        usernameLastChangedAt: timestamp("username_last_changed_at"),
        wantsMarketingEmail: boolean("wants_marketing_email")
            .notNull()
            .default(false),
        wantsMarketingWhatsapp: boolean("wants_marketing_whatsapp")
            .notNull()
            .default(false),
        deletedAt: timestamp("deleted_at"),
        lastLoginAt: timestamp("last_login_at"),
        loginCount: integer("login_count").notNull().default(0),
        isBlocked: boolean("is_blocked").notNull().default(false),
        blockReason: text("block_reason"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        // FK diferida a tiers
        foreignKey({
            columns: [table.currentTierId],
            foreignColumns: [tiers.id],
            name: "fk_clients_current_tier",
        }).onDelete("set null"),
        // Checks
        check(
            "chk_points_non_negative",
            sql`${table.points} >= 0 AND ${table.lifetimePoints} >= 0`
        ),
        check(
            "chk_phone_format",
            sql`${table.phone} ~ '^\+?[0-9\s\-\(\)]{7,20}$'`
        ),
        check(
            "chk_login_count_non_negative",
            sql`${table.loginCount} >= 0`
        ),
        check(
            "chk_age_range",
            sql`${table.birthDate} IS NULL OR (
        AGE(${table.birthDate}) >= INTERVAL '14 years' AND 
        AGE(${table.birthDate}) <= INTERVAL '100 years'
      )`
        ),
        // Índices
        index("idx_clients_phone").on(table.phone),
        index("idx_clients_email").on(table.email),
        index("idx_clients_username").on(table.username),
        index("idx_clients_points").on(table.points),
        index("idx_clients_lifetime_points").on(table.lifetimePoints),
        index("idx_clients_current_tier_id").on(table.currentTierId),
        index("idx_clients_is_blocked").on(table.isBlocked),
        index("idx_clients_deleted_at").on(table.deletedAt),
        // Índice funcional para cumpleaños (expression-based)
        index("idx_clients_birth_date_month_day").using(
            "btree",
            sql`EXTRACT(MONTH FROM ${table.birthDate})`,
            sql`EXTRACT(DAY FROM ${table.birthDate})`
        ),
    ]
);

export const nameChangesHistory = pgTable(
    "name_changes_history",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        clientId: bigint("client_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        oldNames: text("old_names").array().notNull(),
        newName: varchar("new_name", { length: 50 }).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    }
);

// ============================================
// 5. TABLAS - CATÁLOGO (REWARDS)
// ============================================

export const rewardCategories = pgTable(
    "reward_categories",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        name: varchar("name", { length: 100 }).notNull().unique(),
        description: text("description"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    }
);

export const rewards = pgTable(
    "rewards",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        name: varchar("name", { length: 255 }).notNull(),
        description: text("description"),
        imageUrl: text("image_url").array().default(sql`'{}'`),
        pointsRequired: integer("points_required").notNull(),
        tierId: bigint("tier_id", { mode: "number" }).references(() => tiers.id, {
            onDelete: "set null",
        }),
        categoryId: bigint("category_id", { mode: "number" }).references(
            () => rewardCategories.id,
            { onDelete: "set null" }
        ),
        status: rewardStatusEnum("status").notNull().default("active"),
        stock: integer("stock"),
        displayOrder: integer("display_order").default(0),
        isFeatured: boolean("is_featured").default(false),
        deletedAt: timestamp("deleted_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_points_required_positive",
            sql`${table.pointsRequired} > 0`
        ),
        check(
            "chk_stock_non_negative",
            sql`${table.stock} IS NULL OR ${table.stock} >= 0`
        ),
        index("idx_rewards_status").on(table.status),
        index("idx_rewards_tier_id").on(table.tierId),
        index("idx_rewards_category_id").on(table.categoryId),
        index("idx_rewards_points_required").on(table.pointsRequired),
        index("idx_rewards_display_order").on(table.displayOrder),
        index("idx_rewards_is_featured").on(table.isFeatured),
    ]
);

export const redemptions = pgTable(
    "redemptions",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        clientId: bigint("client_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        rewardId: bigint("reward_id", { mode: "number" })
            .notNull()
            .references(() => rewards.id),
        ticketUuid: varchar("ticket_uuid", { length: 36 })
            .notNull()
            .unique()
            .default(sql`uuid_generate_v4()`),
        pointsSpent: integer("points_spent").notNull(),
        status: redemptionStatusEnum("status").notNull().default("pending"),
        reviewedAt: timestamp("reviewed_at"),
        reviewedByAdminId: bigint("reviewed_by_admin_id", {
            mode: "number",
        }).references(() => admins.id, { onDelete: "set null" }),
        rejectionReason: varchar("rejection_reason", { length: 100 }),
        rejectionReasonCustom: text("rejection_reason_custom"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_points_spent_positive",
            sql`${table.pointsSpent} > 0`
        ),
        index("idx_redemptions_client_id").on(table.clientId),
        index("idx_redemptions_reward_id").on(table.rewardId),
        index("idx_redemptions_status").on(table.status),
        index("idx_redemptions_ticket_uuid").on(table.ticketUuid),
        index("idx_redemptions_created_at").on(table.createdAt.desc()),
    ]
);

// ============================================
// 6. TABLAS - GAMIFICACIÓN: REFERIDOS Y BLOQUES
// ============================================

export const referralBlocks = pgTable(
    "referral_blocks",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        name: varchar("name", { length: 100 }).notNull(),
        description: text("description"),
        requiredReferrals: integer("required_referrals").notNull(),
        pointsReward: integer("points_reward").notNull(),
        isActive: boolean("is_active").notNull().default(true),
        isFinal: boolean("is_final").notNull().default(false),
        orderIndex: integer("order_index").notNull().default(0),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_required_referrals_positive",
            sql`${table.requiredReferrals} > 0`
        ),
        check(
            "chk_points_reward_positive",
            sql`${table.pointsReward} > 0`
        ),
        index("idx_referral_blocks_is_active").on(table.isActive),
        index("idx_referral_blocks_order").on(table.orderIndex),
    ]
);

export const referralProgress = pgTable(
    "referral_progress",
    {
        clientId: bigint("client_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        blockId: bigint("block_id", { mode: "number" })
            .notNull()
            .references(() => referralBlocks.id, { onDelete: "cascade" }),
        referralsCount: integer("referrals_count").notNull().default(0),
        isCompleted: boolean("is_completed").notNull().default(false),
        completedAt: timestamp("completed_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        primaryKey({ columns: [table.clientId, table.blockId] }),
        check(
            "chk_referrals_count_non_negative",
            sql`${table.referralsCount} >= 0`
        ),
    ]
);

export const referralHistory = pgTable(
    "referral_history",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        referrerId: bigint("referrer_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        referredId: bigint("referred_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        countedForBlockId: bigint("counted_for_block_id", {
            mode: "number",
        }).references(() => referralBlocks.id, { onDelete: "set null" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_referral_not_self",
            sql`${table.referrerId} != ${table.referredId}`
        ),
        uniqueIndex("uk_referral_pair").on(table.referrerId, table.referredId),
        index("idx_referral_history_referrer_id").on(table.referrerId),
        index("idx_referral_history_referred_id").on(table.referredId),
        index("idx_referral_history_pair").on(table.referrerId, table.referredId),
        index("idx_referral_history_block_id").on(table.countedForBlockId),
    ]
);

// ============================================
// 7. TABLAS - CÓDIGOS Y TRANSACCIONES
// ============================================

export const codes = pgTable(
    "codes",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        code: varchar("code", { length: 50 }).notNull().unique(),
        status: codeStatusEnum("status").notNull().default("unused"),
        pointsValue: integer("points_value").notNull(),
        batchName: varchar("batch_name", { length: 100 }).notNull(),
        expirationDate: timestamp("expiration_date").notNull(),
        usedAt: timestamp("used_at"),
        usedBy: bigint("used_by", { mode: "number" }).references(
            () => clients.id,
            { onDelete: "set null" }
        ),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_points_value_positive",
            sql`${table.pointsValue} > 0`
        ),
        check(
            "chk_code_format",
            sql`${table.code} ~ '^[A-Z0-9\-]+$'`
        ),
        index("idx_codes_batch_name").on(table.batchName),
        index("idx_codes_status").on(table.status),
        index("idx_codes_code").on(table.code),
        index("idx_codes_expiration_date").on(table.expirationDate),
    ]
);

export const pointTransactions = pgTable(
    "point_transactions",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        clientId: bigint("client_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        amount: bigint("amount", { mode: "number" }).notNull(),
        reason: pointTransactionReasonEnum("reason").notNull(),
        referenceId: bigint("reference_id", { mode: "number" }),
        referenceType: varchar("reference_type", { length: 50 }),
        balanceAfter: bigint("balance_after", { mode: "number" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        createdByAdminId: bigint("created_by_admin_id", {
            mode: "number",
        }).references(() => admins.id, { onDelete: "set null" }),
    },
    (table) => [
        check(
            "chk_transaction_amount_not_zero",
            sql`${table.amount} != 0`
        ),
        check(
            "chk_transaction_reference_pair",
            sql`(${table.referenceId} IS NULL AND ${table.referenceType} IS NULL)
        OR (${table.referenceId} IS NOT NULL AND ${table.referenceType} IS NOT NULL)`
        ),
        index("idx_point_transactions_client_id").on(table.clientId),
        index("idx_point_transactions_reason").on(table.reason),
        index("idx_point_transactions_reference_type").on(table.referenceType),
        index("idx_point_transactions_created_at").on(table.createdAt.desc()),
        index("idx_point_transactions_client_created").on(
            table.clientId,
            table.createdAt.desc()
        ),
        index("idx_point_transactions_reference_lookup").on(
            table.referenceType,
            table.referenceId
        ),
    ]
);

// ============================================
// 8. TABLAS - WEBHOOKS Y COMUNICACIÓN
// ============================================

export const webhookEvents = pgTable(
    "webhook_events",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        eventType: varchar("event_type", { length: 50 }).notNull(),
        isPostEvent: boolean("is_post_event").notNull().default(true),
        isGethook: boolean("is_gethook").notNull().default(false),
        eventName: varchar("event_name", { length: 100 }).notNull().unique(),
        description: text("description"),
        webhookUrl: varchar("webhook_url", { length: 500 }),
        secretHash: varchar("secret_hash", { length: 255 }),
        isActive: boolean("is_active").notNull().default(true),
        payloadTemplate: jsonb("payload_template"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_webhook_url_format",
            sql`${table.webhookUrl} IS NULL OR ${table.webhookUrl} ~ '^https?://'`
        ),
        index("idx_webhook_events_is_active").on(table.isActive),
    ]
);

export const adminNotifications = pgTable(
    "admin_notifications",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        adminId: bigint("admin_id", { mode: "number" }).references(
            () => admins.id,
            { onDelete: "cascade" }
        ),
        type: varchar("type", { length: 50 }).notNull(),
        message: text("message").notNull(),
        isRead: boolean("is_read").notNull().default(false),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("idx_admin_notifications_admin_id").on(table.adminId),
        index("idx_admin_notifications_is_read").on(table.isRead),
    ]
);

// ============================================
// 9. TABLAS - GRUPOS Y SEGMENTACIÓN
// ============================================

export const clientGroups = pgTable(
    "client_groups",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        name: varchar("name", { length: 100 }).notNull(),
        description: text("description"),
        deletedAt: timestamp("deleted_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at").defaultNow().notNull(),
    },
    (table) => [
        index("idx_client_groups_deleted_at").on(table.deletedAt),
    ]
);

export const clientGroupMembers = pgTable(
    "client_group_members",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        groupId: bigint("group_id", { mode: "number" })
            .notNull()
            .references(() => clientGroups.id, { onDelete: "cascade" }),
        clientId: bigint("client_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        uniqueIndex("uk_group_member").on(table.groupId, table.clientId),
        index("idx_client_group_members_group_id").on(table.groupId),
        index("idx_client_group_members_client_id").on(table.clientId),
    ]
);

export const campaignsHistory = pgTable(
    "campaigns_history",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        title: varchar("title", { length: 255 }).notNull(),
        body: text("body").notNull(),
        imageUrl: varchar("image_url", { length: 500 }),
        channels: text("channels").array().notNull().default(sql`ARRAY['app']`),
        targetCriteria: jsonb("target_criteria"),
        pointsGifted: integer("points_gifted").notNull().default(0),
        recipientsCount: integer("recipients_count").notNull().default(0),
        scheduledAt: timestamp("scheduled_at"),
        sentAt: timestamp("sent_at"),
        status: campaignStatusEnum("status").notNull().default("draft"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_campaign_counts_non_negative",
            sql`${table.pointsGifted} >= 0 AND ${table.recipientsCount} >= 0`
        ),
        check(
            "chk_campaign_status",
            sql`${table.status} IN ('draft', 'scheduled', 'sent', 'completed', 'failed')`
        ),
        index("idx_campaigns_history_created_at").on(table.createdAt.desc()),
        index("idx_campaigns_history_status").on(table.status),
        index("idx_campaigns_history_target_criteria_gin").using(
            "gin",
            table.targetCriteria
        ),
    ]
);

export const settings = pgTable("settings", {
    key: varchar("key", { length: 100 }).primaryKey(),
    value: text("value").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const gdprErasureRequests = pgTable(
    "gdpr_erasure_requests",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        clientId: bigint("client_id", { mode: "number" })
            .notNull()
            .references(() => clients.id, { onDelete: "cascade" }),
        requestedAt: timestamp("requested_at").defaultNow().notNull(),
        executedAt: timestamp("executed_at"),
        executedByAdminId: bigint("executed_by_admin_id", {
            mode: "number",
        }).references(() => admins.id, { onDelete: "set null" }),
        status: varchar("status", { length: 20 }).notNull().default("pending"),
        reason: text("reason"),
    },
    (table) => [
        check(
            "chk_gdpr_erasure_status",
            sql`${table.status} IN ('pending', 'executed', 'rejected')`
        ),
        index("idx_gdpr_erasure_requests_client_id").on(table.clientId),
        index("idx_gdpr_erasure_requests_status").on(table.status),
    ]
);

export const webhookDeliveryLogs = pgTable(
    "webhook_delivery_logs",
    {
        id: bigserial("id", { mode: "number" }).primaryKey(),
        webhookEventId: bigint("webhook_event_id", { mode: "number" }).references(
            () => webhookEvents.id,
            { onDelete: "set null" }
        ),
        eventType: varchar("event_type", { length: 50 }).notNull(),
        url: varchar("url", { length: 500 }).notNull(),
        payload: jsonb("payload").notNull(),
        deliveryStatus: webhookDeliveryStatusEnum("delivery_status")
            .notNull()
            .default("pending"),
        statusCode: integer("status_code"),
        response: text("response"),
        intentCount: integer("intent_count").notNull().default(1),
        errorMessage: text("error_message"),
        nextRetryAt: timestamp("next_retry_at"),
        deliveredAt: timestamp("delivered_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        check(
            "chk_webhook_delivery_status",
            sql`${table.deliveryStatus} IN ('pending', 'success', 'failed')`
        ),
        index("idx_webhook_delivery_logs_event_id").on(table.webhookEventId),
        index("idx_webhook_delivery_logs_event_type").on(table.eventType),
        index("idx_webhook_delivery_logs_status_retry").on(
            table.deliveryStatus,
            table.nextRetryAt
        ),
        index("idx_webhook_delivery_logs_next_retry").on(table.nextRetryAt),
    ]
);

// ============================================
// 10. RELATIONS (Drizzle ORM relational queries)
// ============================================

export const adminsRelations = relations(admins, ({ many }) => ({
    auditLogs: many(auditLogs),
    adminNotifications: many(adminNotifications),
    reviewedRedemptions: many(redemptions),
    pointTransactions: many(pointTransactions),
    gdprErasureRequests: many(gdprErasureRequests),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
    admin: one(admins, {
        fields: [auditLogs.adminId],
        references: [admins.id],
    }),
}));

export const authAttemptsRelations = relations(authAttempts, () => ({}));

export const tiersRelations = relations(tiers, ({ many }) => ({
    clients: many(clients),
    rewards: many(rewards),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
    currentTier: one(tiers, {
        fields: [clients.currentTierId],
        references: [tiers.id],
    }),
    nameChangesHistory: many(nameChangesHistory),
    redemptions: many(redemptions),
    referralsMade: many(referralHistory, { relationName: "referrer" }),
    referralsReceived: many(referralHistory, { relationName: "referred" }),
    referralProgress: many(referralProgress),
    codes: many(codes),
    pointTransactions: many(pointTransactions),
    clientGroupMembers: many(clientGroupMembers),
    gdprErasureRequests: many(gdprErasureRequests),
}));

export const nameChangesHistoryRelations = relations(
    nameChangesHistory,
    ({ one }) => ({
        client: one(clients, {
            fields: [nameChangesHistory.clientId],
            references: [clients.id],
        }),
    })
);

export const rewardCategoriesRelations = relations(
    rewardCategories,
    ({ many }) => ({
        rewards: many(rewards),
    })
);

export const rewardsRelations = relations(rewards, ({ one, many }) => ({
    tier: one(tiers, {
        fields: [rewards.tierId],
        references: [tiers.id],
    }),
    category: one(rewardCategories, {
        fields: [rewards.categoryId],
        references: [rewardCategories.id],
    }),
    redemptions: many(redemptions),
}));

export const redemptionsRelations = relations(redemptions, ({ one }) => ({
    client: one(clients, {
        fields: [redemptions.clientId],
        references: [clients.id],
    }),
    reward: one(rewards, {
        fields: [redemptions.rewardId],
        references: [rewards.id],
    }),
    reviewedByAdmin: one(admins, {
        fields: [redemptions.reviewedByAdminId],
        references: [admins.id],
    }),
}));

export const referralBlocksRelations = relations(
    referralBlocks,
    ({ many }) => ({
        referralProgress: many(referralProgress),
        referralHistory: many(referralHistory),
    })
);

export const referralProgressRelations = relations(
    referralProgress,
    ({ one }) => ({
        client: one(clients, {
            fields: [referralProgress.clientId],
            references: [clients.id],
        }),
        block: one(referralBlocks, {
            fields: [referralProgress.blockId],
            references: [referralBlocks.id],
        }),
    })
);

export const referralHistoryRelations = relations(
    referralHistory,
    ({ one }) => ({
        referrer: one(clients, {
            fields: [referralHistory.referrerId],
            references: [clients.id],
            relationName: "referrer",
        }),
        referred: one(clients, {
            fields: [referralHistory.referredId],
            references: [clients.id],
            relationName: "referred",
        }),
        countedForBlock: one(referralBlocks, {
            fields: [referralHistory.countedForBlockId],
            references: [referralBlocks.id],
        }),
    })
);

export const codesRelations = relations(codes, ({ one }) => ({
    usedByClient: one(clients, {
        fields: [codes.usedBy],
        references: [clients.id],
    }),
}));

export const pointTransactionsRelations = relations(
    pointTransactions,
    ({ one }) => ({
        client: one(clients, {
            fields: [pointTransactions.clientId],
            references: [clients.id],
        }),
        createdByAdmin: one(admins, {
            fields: [pointTransactions.createdByAdminId],
            references: [admins.id],
        }),
    })
);

export const webhookEventsRelations = relations(
    webhookEvents,
    ({ many }) => ({
        deliveryLogs: many(webhookDeliveryLogs),
    })
);

export const adminNotificationsRelations = relations(
    adminNotifications,
    ({ one }) => ({
        admin: one(admins, {
            fields: [adminNotifications.adminId],
            references: [admins.id],
        }),
    })
);

export const clientGroupsRelations = relations(clientGroups, ({ many }) => ({
    members: many(clientGroupMembers),
}));

export const clientGroupMembersRelations = relations(
    clientGroupMembers,
    ({ one }) => ({
        group: one(clientGroups, {
            fields: [clientGroupMembers.groupId],
            references: [clientGroups.id],
        }),
        client: one(clients, {
            fields: [clientGroupMembers.clientId],
            references: [clients.id],
        }),
    })
);

export const webhookDeliveryLogsRelations = relations(
    webhookDeliveryLogs,
    ({ one }) => ({
        webhookEvent: one(webhookEvents, {
            fields: [webhookDeliveryLogs.webhookEventId],
            references: [webhookEvents.id],
        }),
    })
);

export const gdprErasureRequestsRelations = relations(
    gdprErasureRequests,
    ({ one }) => ({
        client: one(clients, {
            fields: [gdprErasureRequests.clientId],
            references: [clients.id],
        }),
        executedByAdmin: one(admins, {
            fields: [gdprErasureRequests.executedByAdminId],
            references: [admins.id],
        }),
    })
);

// ============================================
// 11. VISTA - v_client_summary
// ============================================

export const vClientSummary = pgView("v_client_summary").as((qb) =>
    qb
        .select({
            id: clients.id,
            username: clients.username,
            phone: clients.phone,
            points: clients.points,
            lifetimePoints: clients.lifetimePoints,
            currentTier: tiers.name,
            isBlocked: clients.isBlocked,
            lastLoginAt: clients.lastLoginAt,
            createdAt: clients.createdAt,
        })
        .from(clients)
        .leftJoin(tiers, sql`${tiers.id} = ${clients.currentTierId}`)
        .where(sql`${clients.deletedAt} IS NULL`)
);
