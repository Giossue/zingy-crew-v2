-- ============================================
-- SCHEMA: Crew Zingy (Single-Tenant, Gamificado, Multi-canal)
-- Descripción: Plataforma de fidelización basada en webhooks, lógica de bloques y auditoría pura.
-- Versión: 3.1.0 (CORREGIDA)
-- ============================================

-- ============================================
-- 1. EXTENSIONES RECOMENDADAS
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. ENUMS
-- ============================================
CREATE TYPE reward_status AS ENUM ('active', 'inactive', 'out_of_stock');
CREATE TYPE redemption_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE point_transaction_reason AS ENUM (
  'purchase', 
  'admin_assigned', 
  'redemption_in_reward', 
  'referral_bonus', 
  'campaign_gift', 
  'refund', 
  'code_claim',
  'birthday_bonus',      -- ✅ AGREGADO: puntos por cumpleaños
  'registration_bonus'   -- ✅ AGREGADO: puntos por registro
);
CREATE TYPE code_status AS ENUM ('unused', 'used', 'expired');
CREATE TYPE campaign_status AS ENUM ('draft', 'scheduled', 'sent', 'completed', 'failed'); -- ✅ AGREGADO
CREATE TYPE webhook_delivery_status AS ENUM ('pending', 'success', 'failed'); -- ✅ AGREGADO

-- ============================================
-- 3. ADMINISTRACIÓN Y SEGURIDAD
-- ============================================

-- USUARIOS ADMIN: Gestión de acceso, auditoría y seguridad
CREATE TABLE admins (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- CONTACTOS QUEMADOS: Para evitar que clientes bloqueados vuelvan a registrarse
CREATE TABLE burned_contacts (
  id BIGSERIAL PRIMARY KEY,
  contact_type VARCHAR(20) NOT NULL,
  contact_value VARCHAR(255) NOT NULL UNIQUE,
  burned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_burned_contact_type CHECK (contact_type IN ('email', 'phone'))
);

-- LOGS DE AUDITORÍA: Registro inmutable de cambios críticos
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  action_type VARCHAR(50) NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  target_id BIGINT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ✅ AGREGADO: Tabla para rate-limiting de OTP/logins (seguridad)
CREATE TABLE auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  identifier VARCHAR(255) NOT NULL, -- email, phone, o username
  attempt_type VARCHAR(20) NOT NULL, -- 'otp_request', 'login', 'register'
  success BOOLEAN NOT NULL DEFAULT false,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 4. CLIENTES Y NEGOCIO
-- ============================================

-- USUARIOS CLIENTES: Registro de clientes con validaciones
CREATE TABLE clients (
  id BIGSERIAL PRIMARY KEY,
  id_referral VARCHAR(36) UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE, -- ✅ ACTUALIZADO: permite formato internacional
  email VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_svg VARCHAR(100) NOT NULL DEFAULT 'default.svg',
  birth_date DATE,
  points BIGINT NOT NULL DEFAULT 0,
  lifetime_points BIGINT NOT NULL DEFAULT 0,
  current_tier_id BIGINT,
  username_last_changed_at TIMESTAMP,
  -- ✅ ACTUALIZADO: Preferencias de marketing separadas por canal
  wants_marketing_email BOOLEAN NOT NULL DEFAULT false,
  wants_marketing_whatsapp BOOLEAN NOT NULL DEFAULT false,
  deleted_at TIMESTAMP,
  last_login_at TIMESTAMP,
  login_count INTEGER NOT NULL DEFAULT 0,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  -- ✅ ACTUALIZADO: Constraints de negocio
  CONSTRAINT chk_points_non_negative CHECK (points >= 0 AND lifetime_points >= 0),
  CONSTRAINT chk_phone_format CHECK (phone ~ '^\+?[0-9\s\-\(\)]{7,20}$'), -- ✅ PERMITE INTERNACIONAL
  CONSTRAINT chk_login_count_non_negative CHECK (login_count >= 0),
  CONSTRAINT chk_age_range CHECK (
    birth_date IS NULL OR (
      AGE(birth_date) >= INTERVAL '14 years' AND 
      AGE(birth_date) <= INTERVAL '100 years'
    )
  ) -- ✅ VALIDA EDAD 14-100 AÑOS
);

-- HISTÓRICO DE CAMBIOS DE NOMBRE DE USUARIO
CREATE TABLE name_changes_history (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  old_names TEXT[] NOT NULL,
  new_name VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 5. CATÁLOGO DINÁMICO
-- ============================================

-- NIVELES DE CLIENTE
CREATE TABLE tiers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  points_required INTEGER NOT NULL DEFAULT 0,
  -- ✅ AGREGADO: Beneficios del nivel
  benefits JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- CATEGORÍAS DE RECOMPENSAS
CREATE TABLE reward_categories (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- RECOMPENSAS
CREATE TABLE rewards (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  image_url TEXT[] DEFAULT '{}',
  points_required INTEGER NOT NULL,
  tier_id BIGINT REFERENCES tiers(id) ON DELETE SET NULL,
  category_id BIGINT REFERENCES reward_categories(id) ON DELETE SET NULL,
  status reward_status NOT NULL DEFAULT 'active',
  stock INTEGER DEFAULT NULL,
  -- ✅ AGREGADO: Campos para organización del catálogo
  display_order INTEGER DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_points_required_positive CHECK (points_required > 0),
  CONSTRAINT chk_stock_non_negative CHECK (stock IS NULL OR stock >= 0)
);

-- CANJES
CREATE TABLE redemptions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  reward_id BIGINT NOT NULL REFERENCES rewards(id), -- ✅ ELIMINADO: ON DELETE CASCADE (ver nota abajo)
  ticket_uuid VARCHAR(36) NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
  points_spent INTEGER NOT NULL,
  status redemption_status NOT NULL DEFAULT 'pending',
  reviewed_at TIMESTAMP,
  reviewed_by_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  -- ✅ AGREGADO: Motivo de rechazo (CRÍTICO)
  rejection_reason VARCHAR(100),
  rejection_reason_custom TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_points_spent_positive CHECK (points_spent > 0)
);

-- ============================================
-- 6. GAMIFICACIÓN: REFERIDOS Y BLOQUES
-- ============================================

-- BLOQUES DE REFERIDOS
CREATE TABLE referral_blocks (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  required_referrals INTEGER NOT NULL,
  points_reward INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- ✅ AGREGADO: Indicador de bloque final
  is_final BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_required_referrals_positive CHECK (required_referrals > 0),
  CONSTRAINT chk_points_reward_positive CHECK (points_reward > 0)
);

-- PROGRESO DE REFERIDOS
CREATE TABLE referral_progress (
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  block_id BIGINT NOT NULL REFERENCES referral_blocks(id) ON DELETE CASCADE,
  referrals_count INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_referrals_count_non_negative CHECK (referrals_count >= 0),
  PRIMARY KEY (client_id, block_id)
);

-- HISTÓRICO DE REFERIDOS
CREATE TABLE referral_history (
  id BIGSERIAL PRIMARY KEY,
  referrer_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  referred_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  -- ✅ AGREGADO: Trazabilidad por bloque
  counted_for_block_id BIGINT REFERENCES referral_blocks(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_referral_not_self CHECK (referrer_id != referred_id),
  -- ✅ AGREGADO: Evitar referidos duplicados
  CONSTRAINT uk_referral_pair UNIQUE (referrer_id, referred_id)
);

-- ============================================
-- 7. CÓDIGOS FÍSICOS Y TRANSACCIONES
-- ============================================

-- CÓDIGOS
CREATE TABLE codes (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  status code_status NOT NULL DEFAULT 'unused',
  points_value INTEGER NOT NULL,
  batch_name VARCHAR(100) NOT NULL,
  expiration_date TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  used_by BIGINT REFERENCES clients(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_points_value_positive CHECK (points_value > 0),
  -- ✅ AGREGADO: Validación de formato de código
  CONSTRAINT chk_code_format CHECK (code ~ '^[A-Z0-9\-]+$')
);

-- TRANSACCIONES DE PUNTOS
CREATE TABLE point_transactions (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  reason point_transaction_reason NOT NULL,
  reference_id BIGINT,
  reference_type VARCHAR(50),
  balance_after BIGINT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_by_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  
  CONSTRAINT chk_transaction_amount_not_zero CHECK (amount != 0),
  CONSTRAINT chk_transaction_reference_pair CHECK (
    (reference_id IS NULL AND reference_type IS NULL)
    OR (reference_id IS NOT NULL AND reference_type IS NOT NULL)
  )
);

-- ============================================
-- 8. WEBHOOKS Y COMUNICACIÓN
-- ============================================

-- EVENTOS DE WEBHOOK
CREATE TABLE webhook_events (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  is_post_event BOOLEAN NOT NULL DEFAULT true,
  is_gethook BOOLEAN NOT NULL DEFAULT false,
  event_name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  webhook_url VARCHAR(500),
  -- ✅ AGREGADO: Hash de la secret_key para HMAC (CRÍTICO)
  secret_hash VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  payload_template JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_webhook_url_format CHECK (webhook_url IS NULL OR webhook_url ~ '^https?://')
);

-- NOTIFICACIONES INTERNAS PARA ADMINS
CREATE TABLE admin_notifications (
  id BIGSERIAL PRIMARY KEY,
  admin_id BIGINT REFERENCES admins(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ============================================
-- 9. GRUPOS Y SEGMENTACIÓN
-- ============================================

-- GRUPOS DE CLIENTES
CREATE TABLE client_groups (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  deleted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- MIEMBROS DE GRUPOS
CREATE TABLE client_group_members (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES client_groups(id) ON DELETE CASCADE,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT uk_group_member UNIQUE (group_id, client_id)
);

-- HISTÓRICO DE CAMPAÑAS
CREATE TABLE campaigns_history (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  image_url VARCHAR(500),
  -- ✅ AGREGADO: Canales de comunicación
  channels TEXT[] NOT NULL DEFAULT ARRAY['app'],
  target_criteria JSONB,
  points_gifted INTEGER NOT NULL DEFAULT 0,
  recipients_count INTEGER NOT NULL DEFAULT 0,
  -- ✅ AGREGADO: Fechas y estado de campaña
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  status campaign_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_campaign_counts_non_negative CHECK (points_gifted >= 0 AND recipients_count >= 0),
  CONSTRAINT chk_campaign_status CHECK (status IN ('draft', 'scheduled', 'sent', 'completed', 'failed'))
);

-- CONFIGURACIÓN GLOBAL
CREATE TABLE settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- REGISTRO DE BORRADO LEGAL (GDPR)
CREATE TABLE gdpr_erasure_requests (
  id BIGSERIAL PRIMARY KEY,
  client_id BIGINT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  executed_at TIMESTAMP,
  executed_by_admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  reason TEXT,
  
  CONSTRAINT chk_gdpr_erasure_status CHECK (status IN ('pending', 'executed', 'rejected'))
);

-- LOG DE ENTREGAS DE WEBHOOK
CREATE TABLE webhook_delivery_logs (
  id BIGSERIAL PRIMARY KEY,
  webhook_event_id BIGINT REFERENCES webhook_events(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  url VARCHAR(500) NOT NULL,
  payload JSONB NOT NULL,
  delivery_status webhook_delivery_status NOT NULL DEFAULT 'pending',
  status_code INTEGER,
  response TEXT,
  intent_count INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  next_retry_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_webhook_delivery_status CHECK (delivery_status IN ('pending', 'success', 'failed'))
);

-- ============================================
-- 10. FOREIGN KEYS DIFERIDAS
-- ============================================
ALTER TABLE clients
ADD CONSTRAINT fk_clients_current_tier
FOREIGN KEY (current_tier_id) REFERENCES tiers(id) ON DELETE SET NULL;

-- ============================================
-- 11. ÍNDICES ESTRATÉGICOS
-- ============================================
CREATE INDEX idx_admins_email ON admins(email);
CREATE INDEX idx_burned_contacts_value ON burned_contacts(contact_value);
CREATE INDEX idx_audit_logs_table_target ON audit_logs(table_name, target_id);
CREATE INDEX idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_logs_system_retention ON audit_logs(created_at) WHERE admin_id IS NULL;
CREATE INDEX idx_clients_phone ON clients(phone);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_clients_username ON clients(username);
CREATE INDEX idx_clients_points ON clients(points);
CREATE INDEX idx_clients_lifetime_points ON clients(lifetime_points);
CREATE INDEX idx_clients_current_tier_id ON clients(current_tier_id);
CREATE INDEX idx_clients_is_blocked ON clients(is_blocked);
CREATE INDEX idx_clients_deleted_at ON clients(deleted_at);
-- ✅ AGREGADO: Índice para cumpleaños
CREATE INDEX idx_clients_birth_date_month_day ON clients(EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date));
CREATE INDEX idx_tiers_points_required ON tiers(points_required);
CREATE INDEX idx_rewards_status ON rewards(status);
CREATE INDEX idx_rewards_tier_id ON rewards(tier_id);
CREATE INDEX idx_rewards_category_id ON rewards(category_id);
CREATE INDEX idx_rewards_points_required ON rewards(points_required);
-- ✅ AGREGADO: Índices para organización de catálogo
CREATE INDEX idx_rewards_display_order ON rewards(display_order);
CREATE INDEX idx_rewards_is_featured ON rewards(is_featured);
CREATE INDEX idx_redemptions_client_id ON redemptions(client_id);
CREATE INDEX idx_redemptions_reward_id ON redemptions(reward_id);
CREATE INDEX idx_redemptions_status ON redemptions(status);
CREATE INDEX idx_redemptions_ticket_uuid ON redemptions(ticket_uuid);
-- ✅ AGREGADO: Índice para fecha de creación (rendimiento admin)
CREATE INDEX idx_redemptions_created_at ON redemptions(created_at DESC);
CREATE INDEX idx_referral_blocks_is_active ON referral_blocks(is_active);
CREATE INDEX idx_referral_blocks_order ON referral_blocks(order_index);
CREATE INDEX idx_referral_history_referrer_id ON referral_history(referrer_id);
CREATE INDEX idx_referral_history_referred_id ON referral_history(referred_id);
CREATE INDEX idx_referral_history_pair ON referral_history(referrer_id, referred_id);
-- ✅ AGREGADO: Índice para trazabilidad por bloque
CREATE INDEX idx_referral_history_block_id ON referral_history(counted_for_block_id);
CREATE INDEX idx_codes_batch_name ON codes(batch_name);
CREATE INDEX idx_codes_status ON codes(status);
CREATE INDEX idx_codes_code ON codes(code);
CREATE INDEX idx_codes_expiration_date ON codes(expiration_date);
CREATE INDEX idx_point_transactions_client_id ON point_transactions(client_id);
CREATE INDEX idx_point_transactions_reason ON point_transactions(reason);
CREATE INDEX idx_point_transactions_reference_type ON point_transactions(reference_type);
CREATE INDEX idx_point_transactions_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_point_transactions_client_created ON point_transactions(client_id, created_at DESC);
-- ✅ AGREGADO: Índice para lookup de referencia
CREATE INDEX idx_point_transactions_reference_lookup ON point_transactions(reference_type, reference_id);
CREATE INDEX idx_webhook_events_is_active ON webhook_events(is_active);
CREATE INDEX idx_webhook_delivery_logs_event_id ON webhook_delivery_logs(webhook_event_id);
CREATE INDEX idx_webhook_delivery_logs_event_type ON webhook_delivery_logs(event_type);
CREATE INDEX idx_webhook_delivery_logs_status_retry ON webhook_delivery_logs(delivery_status, next_retry_at);
CREATE INDEX idx_webhook_delivery_logs_next_retry ON webhook_delivery_logs(next_retry_at);
CREATE INDEX idx_admin_notifications_admin_id ON admin_notifications(admin_id);
CREATE INDEX idx_admin_notifications_is_read ON admin_notifications(is_read);
CREATE INDEX idx_client_groups_deleted_at ON client_groups(deleted_at);
CREATE INDEX idx_client_group_members_group_id ON client_group_members(group_id);
CREATE INDEX idx_client_group_members_client_id ON client_group_members(client_id);
CREATE INDEX idx_campaigns_history_created_at ON campaigns_history(created_at DESC);
-- ✅ AGREGADO: Índice para estado de campañas
CREATE INDEX idx_campaigns_history_status ON campaigns_history(status);
CREATE INDEX idx_campaigns_history_target_criteria_gin ON campaigns_history USING GIN (target_criteria);
CREATE INDEX idx_gdpr_erasure_requests_client_id ON gdpr_erasure_requests(client_id);
CREATE INDEX idx_gdpr_erasure_requests_status ON gdpr_erasure_requests(status);
-- ✅ AGREGADO: Índice para auth_attempts (rate-limiting)
CREATE INDEX idx_auth_attempts_identifier_type ON auth_attempts(identifier, attempt_type);
CREATE INDEX idx_auth_attempts_created_at ON auth_attempts(created_at);

-- ============================================
-- 12. DATOS INICIALES - SETTINGS
-- ============================================
INSERT INTO settings (key, value, description) VALUES
('business_name', '', 'Nombre del negocio'),
('business_logo_url', '', 'URL del logo'),
('points_birthday', '0', 'Puntos por cumpleaños'),
('points_registration', '0', 'Puntos por registro'),
('announcement_pre_login', '', 'Mensaje en login/registro'),
('announcement_post_login', '', 'Mensaje persistente post-login'),
('terms_and_conditions', '', 'Texto de T&C'),
('privacy_policy', '', 'Texto de política de privacidad'),
('typebot_url', '', 'URL del chatbot Typebot'),
('min_age_registration', '14', 'Edad mínima para registro'),
('max_age_registration', '100', 'Edad máxima para registro')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 13. TRIGGERS Y FUNCIONES
-- ============================================

-- Robot virtual que actualiza updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ✅ AGREGADO: Trigger para validar edad en registro de clientes
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

-- Política de retención para audit_logs
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

-- Valida contexto de admin para operaciones sensibles
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

-- Redacta campos sensibles de cliente en auditoría
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

-- Política GDPR: anonimiza PII del cliente
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

-- Marca códigos vencidos
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

-- Garantiza estado coherente al crear/actualizar códigos
CREATE OR REPLACE FUNCTION sync_code_status_with_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'unused' AND NEW.expiration_date < CURRENT_TIMESTAMP THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Calcula el tier actual por lifetime_points
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

-- Mantiene clients.current_tier_id sincronizado
CREATE OR REPLACE FUNCTION sync_client_current_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.current_tier_id := resolve_tier_id_by_lifetime_points(NEW.lifetime_points);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recalcula points desde el ledger
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

-- Trigger para consistencia point_transactions ↔ clients.points
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

-- Helper transaccional para reservar stock sin race condition
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

-- ============================================
-- 14. APLICACIÓN DE TRIGGERS
-- ============================================
CREATE TRIGGER trg_admins_updated_at BEFORE UPDATE ON admins FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_clients_current_tier BEFORE INSERT OR UPDATE OF lifetime_points ON clients FOR EACH ROW EXECUTE FUNCTION sync_client_current_tier();
CREATE TRIGGER trg_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ✅ AGREGADO: Trigger para validar edad
CREATE TRIGGER trg_clients_validate_age BEFORE INSERT OR UPDATE OF birth_date ON clients FOR EACH ROW EXECUTE FUNCTION validate_client_age();
CREATE TRIGGER trg_burned_contacts_admin_only BEFORE INSERT OR UPDATE OR DELETE ON burned_contacts FOR EACH ROW EXECUTE FUNCTION require_admin_session_context();
CREATE TRIGGER trg_codes_sync_expiration_status BEFORE INSERT OR UPDATE ON codes FOR EACH ROW EXECUTE FUNCTION sync_code_status_with_expiration();
CREATE TRIGGER trg_tiers_updated_at BEFORE UPDATE ON tiers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_reward_categories_updated_at BEFORE UPDATE ON reward_categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_rewards_updated_at BEFORE UPDATE ON rewards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_redemptions_updated_at BEFORE UPDATE ON redemptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_referral_blocks_updated_at BEFORE UPDATE ON referral_blocks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_referral_progress_updated_at BEFORE UPDATE ON referral_progress FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_webhook_events_updated_at BEFORE UPDATE ON webhook_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_client_groups_updated_at BEFORE UPDATE ON client_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_name_changes_history_updated_at BEFORE UPDATE ON name_changes_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_point_transactions_sync_points AFTER INSERT OR UPDATE OR DELETE ON point_transactions FOR EACH ROW EXECUTE FUNCTION sync_client_points_after_point_transaction();

-- ============================================
-- 15. VISTA DE RESUMEN
-- ============================================
CREATE OR REPLACE VIEW v_client_summary AS
SELECT
  c.id, c.username, c.phone, c.points, c.lifetime_points,
  ct.name AS current_tier,
  c.is_blocked, c.last_login_at, c.created_at
FROM clients c
LEFT JOIN tiers ct ON ct.id = c.current_tier_id
WHERE c.deleted_at IS NULL;

-- ============================================
-- ✅ NOTAS IMPORTANTES DE IMPLEMENTACIÓN
-- ============================================
-- 1. redemptions.reward_id: Se eliminó ON DELETE CASCADE para preservar histórico
--    Si necesitas "borrar" un premio, usa soft delete (deleted_at) en rewards
-- 2. webhook_events.secret_hash: Almacena HASH de la secret_key, nunca el texto plano
--    Usa: encode(digest(secret_key, 'sha256'), 'hex')
-- 3. clients.phone: El regex ahora permite formato internacional (+, espacios, guiones)
-- 4. campaigns_history.channels: Array TEXT[] permite ['app'], ['email'], ['whatsapp'], o combinaciones
-- 5. referral_blocks.is_final: Cuando=true, el sistema repite este bloque indefinidamente
-- 6. auth_attempts: Úsala para implementar rate-limiting (1 min entre OTPs, 3 intentos = 30 min bloqueo)