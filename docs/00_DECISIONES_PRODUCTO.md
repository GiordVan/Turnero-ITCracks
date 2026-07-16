# Decisiones de producto — Turnero (plataforma Dativa)

> **Fecha de consolidación:** 2026-07-16
> **Fuente:** decisiones confirmadas por el product owner (Giordano) durante la sesión de
> auditoría post-F0. Este documento es la **fuente de verdad de producto** del repositorio.
> Si el código contradice algo de acá, es un bug o una decisión nueva que debe registrarse acá.

## Cómo usar este documento

- Cada decisión tiene estado **CONFIRMADA** o **PENDIENTE**.
- Las confirmadas **no se re-preguntan**: se implementan tal como están salvo que el código
  muestre una contradicción material (en cuyo caso se documenta y se consulta).
- Impacto técnico y alternativas descartadas quedan registrados para no re-litigar.

---

## 1. Tenant y estructura organizacional — CONFIRMADA

- El tenant es una **empresa o negocio (`Business`)**, no un profesional.
- Un profesional independiente se modela como **negocio unipersonal** (Business con 1 Professional).
- Cada Business admite conceptualmente **1..N profesionales**; el modelo de datos SIEMPRE
  soporta múltiples profesionales, aunque el plan Basic limite a 1 activo.
- El límite de profesionales activos se implementa con **entitlements validados en backend**
  (no con estructura de datos distinta ni sólo ocultando botones en el frontend).
- Se separan tres conceptos:
  - **`User`**: persona con login (credenciales, roles).
  - **`Professional`**: recurso que presta servicios y recibe reservas. Puede existir **sin User**
    y luego ser invitado a crear cuenta.
  - **`Business`**: tenant dueño de todos los datos.
- Roles dentro del Business: **OWNER** (administra negocio y profesionales) y **STAFF**
  (permisos limitados). Dativa tiene **administradores globales separados** (no son miembros
  de ningún Business).

**Impacto técnico:** `businessId` en todos los dominios (F2); tabla `BusinessMember` con rol;
entitlement `maxActiveProfessionals` evaluado en el service de profesionales; panel Dativa con
auth independiente.

**Alternativas descartadas:**
- Tenant = profesional (rompe el caso salón con varios empleados).
- Limitar Basic con un modelo de datos single-professional (obligaría a migrar el dominio al
  hacer upgrade; el gating por entitlement es reversible y barato).

## 2. Cliente final (quien reserva) — CONFIRMADA

- Reserva **como invitado**: no se le exige crear cuenta.
- Al reservar recibe un **enlace firmado** para consultar / cancelar / reprogramar su reserva.
- **OTP por WhatsApp o email** funciona como mecanismo de recuperación (perdió el enlace).
- Conocer un email o teléfono **no** da acceso a reservas (regla ya aplicada en F0: `my-turns`
  por email deshabilitado).
- Tokens de gestión y OTP: con expiración; vinculados a tenant + cliente + reserva;
  **persistidos hasheados** cuando corresponda; con límite de intentos y rate limiting;
  **nunca en logs**.
- El modelo debe permitir agregar **cuentas de clientes** en el futuro sin rehacer el dominio
  (Customer separado de User; un Customer podrá vincularse a un User más adelante).

**Impacto técnico:** entidades `Customer`, `ManagementToken` (hasheado, single-use donde aplique)
y `OtpCode` (hasheado, intentos limitados) en F1; el token HMAC stateless de F0 es interino y
se reemplaza.

**Alternativas descartadas:** cuenta obligatoria para reservar (fricción letal en el rubro);
"autenticación" por email plano (insegura, eliminada en F0).

## 3. Membresía SaaS — CONFIRMADA

- Se cobra con **Mercado Pago Suscripciones** en la cuenta de **Dativa**.
- La plataforma tiene entidades propias: **`Plan`**, **`Subscription`**, **`SubscriptionEvent`**,
  **`Entitlements`**. MP resuelve el cobro; **Dativa determina los permisos**.
- Fuente de verdad: **backend**, después de validar webhooks y consultar estado en MP.
  **Nunca** se activa una suscripción confiando en el retorno/redirect del frontend.
- **Período de gracia configurable** ante falta de pago; durante la gracia se pueden gestionar
  reservas existentes. Las restricciones exactas sobre publicación y nuevas configuraciones
  durante la gracia deben quedar **modeladas** (ver Pendientes).

**Impacto técnico:** módulo `billing` en F3 con webhooks idempotentes + conciliación; capa de
entitlements consultada por los services (no por el frontend).

**Alternativas descartadas:** Stripe (mercado inicial Argentina → MP), activar plan por retorno
del checkout (inseguro).

## 4. Planes — CONFIRMADA (precios PENDIENTES)

| | **Basic** | **Premium** |
|---|---|---|
| Profesionales activos | 1 | Varios |
| Operación (agenda, reservas, bloqueos) | ✔ básica | ✔ completa |
| Personalización | básica | completa |
| Analíticas | operativas básicas | avanzadas |
| Mercado Pago para señas | ✖ | ✔ (opt-in) |

- Los **precios no están confirmados** (PENDIENTE).
- La separación exacta de analíticas por plan está en
  [02_PLAN_EVOLUCION_F1_F5.md](./02_PLAN_EVOLUCION_F1_F5.md) §Analíticas por nivel.

## 5. Promociones y cupones — CONFIRMADA

- **No hay trial automático general.** Todo acceso gratuito se otorga por **cupones promocionales**.
- Cupones iniciales configurables: **1 mes gratis de Basic** y **1 mes gratis de Premium**.
- Los códigos **no se hardcodean**: Dativa los administra desde su panel.
- El motor de beneficios es **genérico** y debe soportar a futuro: meses gratuitos, descuentos
  porcentuales, descuentos fijos, campañas, colaboraciones, referidos.
- Registro **transaccional** de: intentos válidos e inválidos, canjes, negocio, usuario/email,
  campaña o colaborador, plan otorgado, inicio y vencimiento, conversión posterior a pago,
  retención, cancelación e ingresos atribuidos.
- **Validación y consumo atómicos** en backend (el canje no puede duplicarse por carrera).
- Referidos futuros **reutilizan el motor** de beneficios pero no se mezclan prematuramente en
  una única entidad genérica.

**Alternativas descartadas:** trial automático (atrae curiosos sin intención de pago y complica
la analítica de conversión); códigos en variables de entorno (no administrables).

## 6. Servicios y disponibilidad — CONFIRMADA

- Un Business tiene varios profesionales y servicios; relación **N:M servicio↔profesional**.
- Cada servicio define: nombre, descripción, **duración**, **precio**, **buffer anterior y
  posterior**, profesionales habilitados, **seña opcional** (fija o porcentual), y **capacidad**
  preparada para futuro (grupal), hoy = 1.
- La **disponibilidad base pertenece al profesional**. El servicio puede tener restricciones
  horarias opcionales; por defecto usa todo el horario del profesional.
- Disponibilidad final = intersección de: horario del profesional ∩ restricciones del servicio,
  aplicando duración + buffers, menos bloqueos/vacaciones/excepciones y reservas activas,
  respetando anticipación mínima y ventana máxima.
- **El backend es siempre la fuente de verdad** de qué slots existen y cuáles están libres.

**Alternativas descartadas:** disponibilidad por servicio como base (duplica la agenda del
profesional y genera solapamientos incontrolables).

## 7. Bloqueos y zona horaria — CONFIRMADA

- `TimeBlock` con alcance **por profesional** o **por todo el negocio**.
- Zona horaria inicial `America/Argentina/Buenos_Aires`, **almacenada y configurable por Business**.
- Mercado inicial: **Argentina, ARS, español de Argentina (es-AR)**.

## 8. Reserva y datos del cliente — CONFIRMADA

- Datos del cliente al reservar: **nombre obligatorio, WhatsApp obligatorio, email opcional**;
  teléfono normalizado **E.164**; **consentimiento de notificaciones registrado**.
- Estados de reserva: `PENDING_PAYMENT`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`.
- **No-show manual** en v1. Reprogramación **auditada**. Todo cambio de estado deja **historial**.
- Una reserva con seña **mantiene temporalmente el slot**: expiración inicial **15 minutos,
  configurable**; al expirar se cancela con motivo `PAYMENT_EXPIRED` y **libera el slot**.
- Anticipación mínima, ventana máxima y política de cancelación: **configurables** por Business.

## 9. Notificaciones — CONFIRMADA

- v1: **WhatsApp central operado por Dativa** + **email como fallback obligatorio**.
- Los mensajes identifican claramente negocio, profesional, servicio, fecha y hora.
- OTP y enlaces de gestión son **independientes del canal** (funcionan igual por WA o email).
- Arquitectura preparada para futuro: número/instancia de WhatsApp **propia por Business**
  (posible entitlement Premium), con prioridad: 1) WA propio conectado → 2) WA central Dativa →
  3) email fallback. Cambiar de proveedor **no** debe tocar el dominio de reservas
  (capa de canal/proveedor detrás de una interfaz).

## 10. Señas y Mercado Pago — CONFIRMADA

Dos flujos de dinero **totalmente separados**:

1. **Membresía SaaS**: Business → paga → Dativa (MP Suscripciones, cuenta Dativa). Fase 3.
2. **Seña**: Cliente → paga → Business (MP marketplace/OAuth **por Business**). Fase 4.

Para señas:
- Integración **OAuth por Business**, opcional, **sólo Premium** inicialmente.
- **Comisión de Dativa: 0% inicial, pero modelada** en datos desde el día uno.
- Webhook **validado** como fuente de verdad; tokens MP **cifrados**; webhooks **idempotentes**;
  **conciliación**; reembolsos **manuales en v1 con auditoría**.
- Si MP se desconecta: **no** convertir silenciosamente el servicio a "sin seña". Se conserva la
  configuración y el Business elige explícitamente: reconectar / permitir temporalmente sin seña /
  hacer el servicio no reservable.

## 11. Personalización — CONFIRMADA

- v1: logo, portada, colores, textos, preview, **contraste accesible**, sanitización de textos,
  validación de imágenes.
- Storage: **R2 o S3-compatible detrás de una abstracción**; el dominio no se acopla al proveedor.

## 12. Administración Dativa — CONFIRMADA

- v1: gestión de negocios, suspensión/reactivación, planes, suscripciones, cupones, campañas,
  extensiones manuales, **auditoría de acciones**, métricas globales.
- **Sin impersonación en v1** (descartada por riesgo de seguridad/privacidad; se re-evalúa después).

## 13. Infraestructura — CONFIRMADA

- **Railway** con **staging separado de producción**. PostgreSQL. **CI obligatorio**.
- Observabilidad progresiva (logs → errores → métricas → alertas).
- **Backups con restore probado antes de operar con usuarios reales.**

---

## Decisiones PENDIENTES (no bloquean F1)

| # | Decisión | Necesaria para | Notas |
|---|----------|----------------|-------|
| P1 | Precios de Basic y Premium | F3 (alta de planes reales) | El modelo `Plan` los parametriza; no bloquea diseño. |
| P2 | Restricciones exactas durante el período de gracia (¿se despublica la página? ¿se bloquean nuevas configuraciones?) | F3 | Se modela como flags por estado de suscripción; default propuesto: gracia = operar reservas existentes + recibir nuevas, sin cambios de configuración "premium". |
| P3 | % de comisión futura de Dativa sobre señas | F4 (queda 0% modelado) | Campo `applicationFeeBps` desde el día uno. |
| P4 | Política de cancelación por defecto (horas de anticipación, ¿retiene seña?) | F1 (config con default) | Default propuesto: cancelable hasta 24 h antes; seña no reembolsable automáticamente (reembolso manual v1). |
| P5 | Naming público de la plataforma (hoy "Turnero", empresa "Dativa") | F2 (slug/página pública, emails) | No afecta el dominio. |
| P6 | Proveedor de WhatsApp central definitivo (hoy Evolution API en el MVP) | F1 (canal real) | La capa de canal lo abstrae; decidir antes de enviar mensajes reales a clientes. |

## Contradicciones materiales detectadas entre decisiones y código actual

Ninguna bloqueante. El MVP actual es single-tenant "peluquería" (WAITING/CALLED/…, sin Business,
sin Customer, seña simulada), lo cual es **esperado**: las decisiones de arriba describen el
objetivo F1–F5, no el estado actual. El mapa de brechas está en
[01_AUDITORIA_FASE_0.md](./01_AUDITORIA_FASE_0.md) y el camino en
[02_PLAN_EVOLUCION_F1_F5.md](./02_PLAN_EVOLUCION_F1_F5.md).
