---
trigger: always_on
---

🗺️ Plan Maestro de Desarrollo: Crew Zingy v3.1
Hemos dividido el sistema en 7 fases incrementales. Cada fase construye sobre la anterior, manteniendo el sistema testeable en todo momento.

Fase 1: Core de Datos y Portal Admin (Actual)

Mapeo completo del esquema en Drizzle (schema.ts).

Login de Admin con NextAuth v5 e inyección de sesión.

Layout base y UI del login con HeroUI.

Fase 2: Portal Cliente y Seguridad Custom

Implementación del Step Form de registro de clientes.

Autenticación por JWT custom (cookies HTTP-only) y validación de OTP.

Middleware robusto para proteger /client/* y /admin/*.

Fase 3: Catálogo, Premios y Control de Concurrencia

CRUD de Premios y Categorías en el Admin.

Galería de premios en el portal cliente.

Integración de la función SQL reserve_reward_stock para canjes seguros.

Fase 4: Flujo de Canjes y Ledger Financiero

Solicitud de canje desde el cliente.

Panel de aprobación/rechazo en el Admin (/admin/redemptions).

Integración estricta con la tabla point_transactions (Ledger).

Fase 5: Gamificación (Niveles y Referidos)

Lógica de bloques escalonados para referidos (referral_blocks, referral_progress).

Sincronización automática de Tiers basada en lifetime_points.

Fase 6: Ingesta de Puntos y Códigos Físicos

Generador de lotes de códigos en el Admin.

Módulo de validación e ingreso de códigos en el portal cliente.

Fase 7: Webhooks, Campañas y Cumplimiento (GDPR)

Worker/Asincronía para disparar webhooks y registrar en webhook_delivery_logs.

UI de segmentación de campañas y ejecución de borrado GDPR.