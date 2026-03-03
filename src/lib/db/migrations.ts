// ============================================
// MIGRATIONS: Funciones PL/pgSQL, Triggers y Extensiones
// Crew Zingy - Traducción completa de schema.md v3.1.0
// ============================================
// Estas son operaciones que Drizzle ORM no puede expresar declarativamente.
// Se ejecutan con db.execute(sqlStatement) durante la migración inicial.
// ============================================

import { sql } from "drizzle-orm";

// ============================================
// 1. EXTENSIONES
// ============================================

export const createExtensions = sql`
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
`;

// ============================================
// 2. FUNCIONES PL/pgSQL
// ============================================

/** Robot virtual que actualiza updated_at */
export const fnUpdateUpdatedAtColumn = sql`
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Trigger para validar edad en registro de clientes */
export const fnValidateClientAge = sql`
  CREATE OR REPLACE FUNCTION validate_client_age()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.birth_date IS NOT NULL THEN
      IF AGE(NEW.birth_date) < INTERVAL '14 years' OR AGE(NEW.birth_date) > INTERVAL '100 years' THEN
        RAISE EXCEPTION 'La fecha de nacimiento debe corresponder a una edad entre 14 y 100 años';
      END IF;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Política de retención para audit_logs */
export const fnPurgeAuditLogs = sql`
  CREATE OR REPLACE FUNCTION purge_audit_logs(
    p_older_than INTERVAL DEFAULT INTERVAL '1 year',
    p_system_only BOOLEAN DEFAULT TRUE
  )
  RETURNS INTEGER AS $$
  DECLARE
    v_deleted_count INTEGER;
  BEGIN
    IF p_system_only THEN
      DELETE FROM audit_logs
      WHERE admin_id IS NULL
      AND created_at < (CURRENT_TIMESTAMP - p_older_than);
    ELSE
      DELETE FROM audit_logs
      WHERE created_at < (CURRENT_TIMESTAMP - p_older_than);
    END IF;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Valida contexto de admin para operaciones sensibles */
export const fnRequireAdminSessionContext = sql`
  CREATE OR REPLACE FUNCTION require_admin_session_context()
  RETURNS TRIGGER AS $$
  DECLARE
    v_admin_id BIGINT;
  BEGIN
    BEGIN
      v_admin_id := current_setting('zingy.current_admin_id')::BIGINT;
    EXCEPTION WHEN OTHERS THEN
      v_admin_id := NULL;
    END;
    IF v_admin_id IS NULL THEN
      RAISE EXCEPTION 'Operación restringida: requiere contexto de admin (zingy.current_admin_id)';
    END IF;
    RETURN COALESCE(NEW, OLD);
  END;
  $$ LANGUAGE plpgsql;
`;

/** Redacta campos sensibles de cliente en auditoría */
export const fnRedactClientPiiJsonb = sql`
  CREATE OR REPLACE FUNCTION redact_client_pii_jsonb(p_payload JSONB)
  RETURNS JSONB AS $$
  BEGIN
    IF p_payload IS NULL THEN
      RETURN NULL;
    END IF;
    RETURN p_payload
      - 'email'
      - 'phone'
      - 'username'
      - 'password_hash'
      - 'id_referral'
      - 'birth_date';
  END;
  $$ LANGUAGE plpgsql;
`;

/** Política GDPR: anonimiza PII del cliente */
export const fnAnonymizeClientForGdpr = sql`
  CREATE OR REPLACE FUNCTION anonymize_client_for_gdpr(p_client_id BIGINT, p_reason TEXT DEFAULT NULL)
  RETURNS VOID AS $$
  DECLARE
    v_admin_id BIGINT;
  BEGIN
    BEGIN
      v_admin_id := current_setting('zingy.current_admin_id')::BIGINT;
    EXCEPTION WHEN OTHERS THEN
      v_admin_id := NULL;
    END;
    
    UPDATE clients
    SET
      email = CONCAT('deleted+', p_client_id::TEXT, '@anon.local'),
      phone = LPAD((p_client_id % 100000000000000)::TEXT, 15, '0'),
      username = CONCAT('User#', p_client_id::TEXT),
      password_hash = 'gdpr_erased',
      id_referral = NULL,
      birth_date = NULL,
      wants_marketing_email = false,
      wants_marketing_whatsapp = false,
      deleted_at = COALESCE(deleted_at, CURRENT_TIMESTAMP),
      is_blocked = true,
      block_reason = 'GDPR_ERASURE',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = p_client_id;

    UPDATE audit_logs
    SET
      old_values = redact_client_pii_jsonb(old_values),
      new_values = redact_client_pii_jsonb(new_values)
    WHERE table_name = 'clients' AND target_id = p_client_id;

    INSERT INTO gdpr_erasure_requests (client_id, executed_at, executed_by_admin_id, status, reason)
    VALUES (p_client_id, CURRENT_TIMESTAMP, v_admin_id, 'executed', p_reason);
  END;
  $$ LANGUAGE plpgsql;
`;

/** Marca códigos vencidos */
export const fnExpireCodesNow = sql`
  CREATE OR REPLACE FUNCTION expire_codes_now()
  RETURNS INTEGER AS $$
  DECLARE
    v_updated INTEGER;
  BEGIN
    UPDATE codes
    SET status = 'expired'
    WHERE status = 'unused' AND expiration_date < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    RETURN v_updated;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Garantiza estado coherente al crear/actualizar códigos */
export const fnSyncCodeStatusWithExpiration = sql`
  CREATE OR REPLACE FUNCTION sync_code_status_with_expiration()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.status = 'unused' AND NEW.expiration_date < CURRENT_TIMESTAMP THEN
      NEW.status := 'expired';
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Calcula el tier actual por lifetime_points */
export const fnResolveTierIdByLifetimePoints = sql`
  CREATE OR REPLACE FUNCTION resolve_tier_id_by_lifetime_points(p_lifetime_points BIGINT)
  RETURNS BIGINT AS $$
  DECLARE
    v_tier_id BIGINT;
  BEGIN
    SELECT t.id INTO v_tier_id
    FROM tiers t
    WHERE t.points_required <= p_lifetime_points
    ORDER BY t.points_required DESC
    LIMIT 1;
    RETURN v_tier_id;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Mantiene clients.current_tier_id sincronizado */
export const fnSyncClientCurrentTier = sql`
  CREATE OR REPLACE FUNCTION sync_client_current_tier()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.current_tier_id := resolve_tier_id_by_lifetime_points(NEW.lifetime_points);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Recalcula points desde el ledger */
export const fnReconcileClientPointsFromLedger = sql`
  CREATE OR REPLACE FUNCTION reconcile_client_points_from_ledger(p_client_id BIGINT)
  RETURNS VOID AS $$
  BEGIN
    UPDATE clients c
    SET points = COALESCE((
      SELECT SUM(pt.amount)
      FROM point_transactions pt
      WHERE pt.client_id = p_client_id
    ), 0)
    WHERE c.id = p_client_id;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Trigger para consistencia point_transactions ↔ clients.points */
export const fnSyncClientPointsAfterPointTransaction = sql`
  CREATE OR REPLACE FUNCTION sync_client_points_after_point_transaction()
  RETURNS TRIGGER AS $$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM reconcile_client_points_from_ledger(NEW.client_id);
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
      IF OLD.client_id IS DISTINCT FROM NEW.client_id THEN
        PERFORM reconcile_client_points_from_ledger(OLD.client_id);
      END IF;
      PERFORM reconcile_client_points_from_ledger(NEW.client_id);
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM reconcile_client_points_from_ledger(OLD.client_id);
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;
`;

/** Helper transaccional para reservar stock sin race condition */
export const fnReserveRewardStock = sql`
  CREATE OR REPLACE FUNCTION reserve_reward_stock(p_reward_id BIGINT)
  RETURNS BOOLEAN AS $$
  DECLARE
    v_stock INTEGER;
  BEGIN
    SELECT r.stock INTO v_stock
    FROM rewards r
    WHERE r.id = p_reward_id
    FOR UPDATE;
    
    IF NOT FOUND THEN
      RETURN FALSE;
    END IF;

    IF v_stock IS NULL THEN
      RETURN TRUE;
    END IF;

    IF v_stock <= 0 THEN
      RETURN FALSE;
    END IF;

    UPDATE rewards
    SET stock = stock - 1,
        status = CASE WHEN stock - 1 = 0 THEN 'out_of_stock' ELSE status END
    WHERE id = p_reward_id;

    RETURN TRUE;
  END;
  $$ LANGUAGE plpgsql;
`;

// ============================================
// 3. TRIGGERS
// ============================================

export const trgAdminsUpdatedAt = sql`
  CREATE TRIGGER trg_admins_updated_at 
  BEFORE UPDATE ON admins 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgClientsCurrentTier = sql`
  CREATE TRIGGER trg_clients_current_tier 
  BEFORE INSERT OR UPDATE OF lifetime_points ON clients 
  FOR EACH ROW EXECUTE FUNCTION sync_client_current_tier();
`;

export const trgClientsUpdatedAt = sql`
  CREATE TRIGGER trg_clients_updated_at 
  BEFORE UPDATE ON clients 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgClientsValidateAge = sql`
  CREATE TRIGGER trg_clients_validate_age 
  BEFORE INSERT OR UPDATE OF birth_date ON clients 
  FOR EACH ROW EXECUTE FUNCTION validate_client_age();
`;

export const trgBurnedContactsAdminOnly = sql`
  CREATE TRIGGER trg_burned_contacts_admin_only 
  BEFORE INSERT OR UPDATE OR DELETE ON burned_contacts 
  FOR EACH ROW EXECUTE FUNCTION require_admin_session_context();
`;

export const trgCodesSyncExpirationStatus = sql`
  CREATE TRIGGER trg_codes_sync_expiration_status 
  BEFORE INSERT OR UPDATE ON codes 
  FOR EACH ROW EXECUTE FUNCTION sync_code_status_with_expiration();
`;

export const trgTiersUpdatedAt = sql`
  CREATE TRIGGER trg_tiers_updated_at 
  BEFORE UPDATE ON tiers 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgRewardCategoriesUpdatedAt = sql`
  CREATE TRIGGER trg_reward_categories_updated_at 
  BEFORE UPDATE ON reward_categories 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgRewardsUpdatedAt = sql`
  CREATE TRIGGER trg_rewards_updated_at 
  BEFORE UPDATE ON rewards 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgRedemptionsUpdatedAt = sql`
  CREATE TRIGGER trg_redemptions_updated_at 
  BEFORE UPDATE ON redemptions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgReferralBlocksUpdatedAt = sql`
  CREATE TRIGGER trg_referral_blocks_updated_at 
  BEFORE UPDATE ON referral_blocks 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgReferralProgressUpdatedAt = sql`
  CREATE TRIGGER trg_referral_progress_updated_at 
  BEFORE UPDATE ON referral_progress 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgWebhookEventsUpdatedAt = sql`
  CREATE TRIGGER trg_webhook_events_updated_at 
  BEFORE UPDATE ON webhook_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgClientGroupsUpdatedAt = sql`
  CREATE TRIGGER trg_client_groups_updated_at 
  BEFORE UPDATE ON client_groups 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgNameChangesHistoryUpdatedAt = sql`
  CREATE TRIGGER trg_name_changes_history_updated_at 
  BEFORE UPDATE ON name_changes_history 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgSettingsUpdatedAt = sql`
  CREATE TRIGGER trg_settings_updated_at 
  BEFORE UPDATE ON settings 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

export const trgPointTransactionsSyncPoints = sql`
  CREATE TRIGGER trg_point_transactions_sync_points 
  AFTER INSERT OR UPDATE OR DELETE ON point_transactions 
  FOR EACH ROW EXECUTE FUNCTION sync_client_points_after_point_transaction();
`;

// ============================================
// 4. ARRAY ORDENADO para ejecución secuencial
// ============================================

/** Todas las funciones en orden de dependencia */
export const allFunctions = [
    fnUpdateUpdatedAtColumn,
    fnValidateClientAge,
    fnPurgeAuditLogs,
    fnRequireAdminSessionContext,
    fnRedactClientPiiJsonb,
    fnAnonymizeClientForGdpr,
    fnExpireCodesNow,
    fnSyncCodeStatusWithExpiration,
    fnResolveTierIdByLifetimePoints,
    fnSyncClientCurrentTier,
    fnReconcileClientPointsFromLedger,
    fnSyncClientPointsAfterPointTransaction,
    fnReserveRewardStock,
];

/** Todos los triggers en orden */
export const allTriggers = [
    trgAdminsUpdatedAt,
    trgClientsCurrentTier,
    trgClientsUpdatedAt,
    trgClientsValidateAge,
    trgBurnedContactsAdminOnly,
    trgCodesSyncExpirationStatus,
    trgTiersUpdatedAt,
    trgRewardCategoriesUpdatedAt,
    trgRewardsUpdatedAt,
    trgRedemptionsUpdatedAt,
    trgReferralBlocksUpdatedAt,
    trgReferralProgressUpdatedAt,
    trgWebhookEventsUpdatedAt,
    trgClientGroupsUpdatedAt,
    trgNameChangesHistoryUpdatedAt,
    trgSettingsUpdatedAt,
    trgPointTransactionsSyncPoints,
];

/** Todo en orden de ejecución */
export const allMigrations = [
    createExtensions,
    ...allFunctions,
    ...allTriggers,
];
