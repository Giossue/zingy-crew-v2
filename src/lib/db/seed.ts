// ============================================
// SEED: Datos iniciales de settings
// Crew Zingy - Traducción completa de schema.md v3.1.0
// ============================================

import { sql } from "drizzle-orm";

/** INSERT INTO settings con ON CONFLICT DO NOTHING */
export const seedSettings = sql`
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
`;
