# Plan de evolución — Fases 1 a 5

> **Fecha:** 2026-07-16 · **Estado base:** MVP single-tenant con F0 (estabilización) aplicada —
> ver [01_AUDITORIA_FASE_0.md](./01_AUDITORIA_FASE_0.md).
> **Decisiones de producto:** [00_DECISIONES_PRODUCTO.md](./00_DECISIONES_PRODUCTO.md) — este plan
> las implementa; no las re-discute.
> **Regla de oro:** cada fase es desplegable y validable antes de empezar la siguiente. Ninguna
> feature se acepta como terminada sin backend + autorización + persistencia + tests.

---

## Arquitectura objetivo

**Forma:** monolito modular (Express 5 + Prisma + PostgreSQL en Railway; SPA React servida por el
mismo servicio). No se introducen microservicios: la modularidad se logra por **módulos de dominio**
con fronteras claras, cada uno con sus routes/controllers/services:

```
backend/src/modules/
  identity/        # User, login, registro, verificación email, invitaciones, roles
  business/        # Business (tenant), BusinessMember, settings, slug, publicación, branding
  catalog/         # Professional, Service, ServiceProfessional
  scheduling/      # AvailabilityRule, TimeBlock, motor de slots
  booking/         # Customer, Booking, estados, historial, reprogramación
  customer-access/ # ManagementToken persistido, OTP, enlaces firmados
  payments/        # Seña: Payment, proveedor (simulado→MP), expiración, reembolsos
  billing/         # SaaS: Plan, Subscription, entitlements, MP Suscripciones
  promotions/      # Campaign, Coupon, Redemption, BenefitGrant
  notifications/   # canal WA/email, plantillas, colas de envío
  analytics/       # AnalyticsEvent, rollups, reporting por plan
  platform-admin/  # panel Dativa: negocios, planes, cupones, métricas, AuditLog
  shared/          # config, prisma (+guardrail tenant), errores, authz, flags, observabilidad
```

**Principios transversales:**
- El backend es la única fuente de verdad (disponibilidad, entitlements, estados de pago).
- Autorización en el service, no en el frontend; el frontend sólo refleja permisos.
- Multitenancy por `businessId` con guardrail programático en Prisma (F2).
- Dinero: nada se activa por redirect del frontend; sólo webhooks validados + consulta de estado.
- Integraciones (WhatsApp, email, storage, pagos) detrás de interfaces; el dominio no conoce
  proveedores.
- Estados con historial auditado; migraciones expand-and-contract; feature flags para todo cambio
  con riesgo de rollback.

## Modelo conceptual objetivo (entidades)

```
Business (tenant) 1─N BusinessMember N─1 User        Dativa: PlatformAdmin (separado)
Business 1─N Professional (puede no tener User; invitable)
Business 1─N Service N─M Professional (ServiceProfessional)
Professional 1─N AvailabilityRule            Business/Professional 1─N TimeBlock
Business 1─N Customer 1─N Booking N─1 Service, N─1 Professional
Booking 1─N BookingStatusHistory · 1─N Payment (seña) · 1─N ManagementToken · notificaciones
Customer 1─N OtpCode
Plan 1─N Subscription N─1 Business · Subscription 1─N SubscriptionEvent
Plan/Business → Entitlements (por plan + overrides)
Campaign 1─N Coupon 1─N CouponRedemption → BenefitGrant → Subscription
Business 0..1 MpConnection (OAuth señas, tokens cifrados)
AuditLog (actor, acción, entidad, businessId?, diff) · FeatureFlag · WebhookEvent (idempotencia)
AnalyticsEvent (businessId, type, refs, metadata) + rollups diarios
```

Convenciones: PKs cuid; fechas `timestamptz`; dinero entero en centavos ARS (`amountCents`);
teléfonos E.164; TZ por Business (default `America/Argentina/Buenos_Aires`); soft-state por
estados + historial (no soft-delete genérico salvo `isActive`).

---

# FASE 1 — Núcleo funcional del MVP (single-tenant, dominio listo para tenantizar)

### 1. Objetivo
Convertir el demo "peluquería" en un producto de reservas real y genérico: servicios con duración,
precio y buffers; disponibilidad por profesional; ciclo de vida completo de la reserva con
historial; gestión del cliente por enlace persistido + OTP; seña simulada con expiración; y
notificaciones coherentes con fallback email. Single-tenant operativo, pero con el dominio
nombrado y estructurado para que F2 sólo agregue `businessId`.

### 2. Problema actual
`Service` existe pero no participa del flujo (sin precio ni buffers); la disponibilidad es una
banda global (`WorkBand`) idéntica para todos; no hay Customer (datos repetidos en cada Turn); los
estados son de "fila de espera" (WAITING/CALLED) y no de reserva; no hay historial ni
reprogramación; el token de gestión es stateless y no revocable; no hay OTP; la seña simulada no
expira ni libera slot; no hay fallback email consistente; no hay E2E; fechas/horas son strings sin TZ.

### 3. Alcance
CRUD de profesionales y servicios (duración, precio, buffers, seña opcional, capacidad futura);
relación N:M servicio↔profesional; disponibilidad semanal por profesional + excepciones;
restricciones horarias opcionales por servicio; bloqueos y vacaciones (por profesional o negocio);
zona horaria configurable (una sola, del negocio); entidad Customer (nombre, WhatsApp E.164
obligatorio, email opcional, consentimiento); Booking con estados
`PENDING_PAYMENT/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW`, motivo de cancelación, historial completo
y reprogramación auditada; no-show manual; reserva manual desde el admin; seña simulada
pendiente con expiración configurable (default 15 min) y liberación automática del slot
(`PAYMENT_EXPIRED`); enlaces de gestión persistidos (hasheados) + OTP por WA/email; notificaciones
que identifican negocio/profesional/servicio/fecha/hora con fallback email obligatorio; anticipación
mínima y ventana máxima; tests E2E iniciales (Playwright); corrección de O-1/O-2 de la auditoría.

### 4. Fuera de alcance
Multitenancy (F2), registro/onboarding (F2), planes/cupones (F3), Mercado Pago real (F4),
branding/analíticas avanzadas/colas (F5), capacidad >1 (sólo queda modelada), cuentas de clientes.

### 5. Dependencias
F0 aprobada (gate cerrado, incluida la corrección H-1). Ninguna externa nueva; Playwright como
devDependency.

### 6. Decisiones de producto aplicables
§2 (cliente invitado, enlace + OTP, tokens hasheados), §6 (servicios/disponibilidad), §7 (TZ),
§8 (datos y estados de reserva, expiración 15 min), §9 (notificaciones y fallback), P4 y P6 de
pendientes (defaults propuestos).

### 7. Modelo de datos
- **Renombrar dominio**: modelo Prisma `Turn` → `Booking` (migración `ALTER TABLE ... RENAME`,
  atómica en PG) y `TurnStatus` → `BookingStatus` con mapeo de datos:
  `WAITING→CONFIRMED`, `CALLED→CONFIRMED`, `IN_PROGRESS→CONFIRMED`, resto igual, más
  `PENDING_PAYMENT` nuevo. Guardar el estado original en `legacyStatus` durante la transición.
- **Booking** (expand): `customerId FK`, `serviceId FK (obligatorio para nuevas)`,
  `professionalId FK obligatorio`, `startAt/endAt timestamptz`, `occupiedFrom/occupiedTo`
  (rango con buffers), `cancellationReason` (`CUSTOMER/ADMIN/PAYMENT_EXPIRED/...`),
  `rescheduledFromId?`, se mantienen `scheduledDate/Time` legacy hasta contract.
- **BookingStatusHistory**: `bookingId, fromStatus, toStatus, reason?, actorType(ADMIN|CUSTOMER|SYSTEM), actorId?, createdAt`.
- **Customer**: `name, phoneE164 (obligatorio), email?, notifyConsentAt?, notes?`; unicidad
  `phoneE164` (por negocio desde F2).
- **Service** (expand): `priceCents, durationMin, bufferBeforeMin, bufferAfterMin,
  depositType(NONE|FIXED|PERCENT), depositValue, capacity default 1, isActive, sortOrder,
  scheduleRestrictions Json?`.
- **ServiceProfessional**: `(serviceId, professionalId)` unique.
- **AvailabilityRule**: `professionalId, weekday 0-6, startTime, endTime, validFrom?, validTo?`.
- **TimeBlock**: `scope(PROFESSIONAL|BUSINESS), professionalId?, startAt, endAt, reason?`.
- **ManagementToken**: `bookingId, tokenHash (sha256), purpose(MANAGE), expiresAt, usedAt?,
  revokedAt?, createdAt` — el token en claro sólo se muestra/envía una vez.
- **OtpCode**: `customerId, channel(WHATSAPP|EMAIL), codeHash, attempts, maxAttempts(5),
  expiresAt, consumedAt?`.
- **Settings** (evolución de AdminConfig singleton): `timezone, minNoticeMinutes, maxWindowDays,
  cancellationPolicyHours, depositExpirationMinutes (15)`.
- **Garantía anti-doble-reserva v2**: el índice único de F0 (igualdad exacta de slot) es
  insuficiente con duraciones/buffers variables → **constraint de exclusión** PostgreSQL
  (`btree_gist`): `EXCLUDE USING gist (professionalId WITH =, tstzrange(occupiedFrom, occupiedTo) WITH &&) WHERE (status <> 'CANCELLED')`.
  La migración que lo crea sigue el patrón F0: **aborta con reporte si hay solapes**, script de
  reparación separado. El índice F0 se elimina recién en el paso *contract*, cuando todas las
  reservas nuevas usan rangos.

### 8. Migraciones (expand-and-contract, en orden)
1. `f1_customer_service_expand`: Customer, ServiceProfessional, columnas nuevas de Service,
   AvailabilityRule, TimeBlock, Settings (backfill desde AdminConfig/WorkBand: cada WorkBand
   activa → AvailabilityRule para cada profesional activo × workingDays).
2. `f1_booking_expand`: rename Turn→Booking, columnas nuevas nullable, enum nuevo con mapeo,
   BookingStatusHistory, ManagementToken, OtpCode; backfill `startAt/endAt/occupiedFrom/To`
   desde `scheduledDate/Time` + duración de config, `customerId` creando Customers por
   (email|phone) únicos; historial inicial sintético `(-, statusActual, reason: MIGRATED)`.
3. `f1_booking_overlap_guard`: `CREATE EXTENSION IF NOT EXISTS btree_gist` + constraint de
   exclusión (con chequeo-aborto previo de solapes, mismo patrón F0).
4. `f1_contract`: NOT NULL en `customerId/startAt/endAt`, drop de `email/customerName/phone`
   en Booking, drop WorkBand y AdminConfig, drop índice único F0. **Sólo tras ≥1 semana estable.**

### 9. Backend
Servicios puros y testeables: `slotEngine` (función pura: reglas ∩ restricciones de servicio −
bloqueos − bookings, aplica duración+buffers+minNotice+maxWindow, opera en TZ del negocio, expone
`getAvailableSlots(serviceId, professionalId?, dateRange)`); `bookingService`
(crear/confirmar/cancelar/reprogramar/no-show/completar con transiciones válidas explícitas y
escritura de historial en la misma transacción); `depositService` (crear PENDING_PAYMENT,
confirmar simulado, **expirar**); `expirationJob` (cron 1 min: `PENDING_PAYMENT` vencidos →
CANCELLED/`PAYMENT_EXPIRED`, libera slot por constraint, notifica); `customerAccessService`
(emitir/rotar/revocar ManagementToken hasheado; OTP: generar, hashear, límite de intentos con
lockout, rate limit dedicado); `notificationService` (plantillas por evento: creada, confirmada,
recordatorio, cancelada, reprogramada; canal WA simulado/central + **fallback email siempre**;
registro en NotificationLog). Rutas públicas nuevas: `GET /public/services`,
`GET /public/services/:id/professionals`, `GET /public/availability`, `POST /public/bookings`,
`GET/POST /public/manage/:token` (ver/cancelar/reprogramar), `POST /public/otp/request|verify`.
Admin: CRUDs de professionals/services/availability/blocks, agenda, reserva manual, transiciones.

### 10. Frontend
Flujo público: servicio → profesional (filtrado por N:M, o "cualquiera") → fecha → slot → datos
(nombre+WhatsApp obligatorios, email opcional, consentimiento) → seña simulada si aplica → éxito
con enlace de gestión. Página `/r/:token` (ver/cancelar/reprogramar) + recuperación por OTP
(reemplaza y elimina `MisTurnosPage` — cierra O-2). Admin: páginas CRUD (profesionales, servicios,
disponibilidad, bloqueos), agenda con reprogramar/no-show/completar, reserva manual.
`NotificationBell`: reconexión SSE con re-fetch de token efímero + backoff (cierra O-1).

### 11. Seguridad
Tokens de gestión persistidos **hasheados** (sha256), un token activo por booking (rotación al
usar OTP), expiración = fin del turno + margen; OTP hasheado, 5 intentos, lockout, rate limit
dedicado por teléfono/IP; enlaces con token en path pero **redactados en logs** (ampliar
`logRedact` a paths `/r/:token` y `/manage/:token`); validación E.164 server-side; sanitización
de notas/textos; mantener H-1 cerrado (tokens con `purpose` sólo válidos para su propósito).

### 12. Autorización y aislamiento
Admin JWT (roles ADMIN; STAFF llega en F2 con membership real). Cliente: sólo vía token de
gestión/OTP — nunca por email/teléfono conocidos. Transiciones de estado validan actor
(CUSTOMER sólo cancela/reprograma lo propio y dentro de la política; ADMIN todo; SYSTEM expira).

### 13. Observabilidad
Log estructurado por evento de dominio (booking.created, booking.expired, otp.locked…);
contadores simples de fallos de notificación; `/api/health` se mantiene; log del expirationJob
con resumen por ciclo.

### 14. Subfases numeradas
- **F1.1 Catálogo**: Service completo + ServiceProfessional + CRUD admin de servicios y
  profesionales (UI incluida).
- **F1.2 Disponibilidad**: AvailabilityRule + TimeBlock + Settings(TZ) + slotEngine + migración 1
  + `GET /public/availability` + UI admin de horarios/bloqueos.
- **F1.3 Booking core**: migraciones 2 y 3, Customer, estados nuevos, historial, transiciones,
  reprogramación, no-show, reserva manual, agenda admin actualizada.
- **F1.4 Acceso del cliente**: ManagementToken persistido + OTP + página `/r/:token` + rate
  limits + redacción de paths; eliminar flujo muerto MisTurnosPage.
- **F1.5 Seña con expiración**: PENDING_PAYMENT + expirationJob + liberación de slot +
  configuración de seña por servicio.
- **F1.6 Notificaciones**: plantillas completas + fallback email obligatorio + consentimiento.
- **F1.7 Cierre**: E2E Playwright, reconexión SSE, migración 4 (contract), hardening y docs.

### 15. Orden exacto de ejecución
F1.1 → F1.2 → F1.3 → F1.4 → F1.5 → F1.6 → F1.7. (F1.4 puede solaparse con F1.5 tras F1.3;
el contract de F1.7 exige una semana de estabilidad post F1.3.)

### 16. Archivos y módulos estimados
`backend/src/modules/{catalog,scheduling,booking,customer-access,payments,notifications}/…`
(~25 archivos nuevos), 4 migraciones + 1 script de reparación de solapes,
`backend/test/…` (~15 archivos nuevos), frontend ~12 páginas/componentes nuevos o reescritos,
`e2e/` con Playwright (~5 specs). Estimado total: ~60 archivos tocados.

### 17. Tests unitarios
slotEngine (casos: buffers, restricciones de servicio, bloqueos negocio/profesional, minNotice,
maxWindow, TZ, DST de AR); máquina de estados de Booking (todas las transiciones válidas e
inválidas); expiración (isExpired puro); OTP (intentos, lockout, expiración); manageToken
persistido (hash, single-active, revocación); composición de plantillas; normalización E.164.

### 18. Tests de integración
Reserva con seña → expira → slot liberado (reloj inyectado); reprogramación escribe historial y
mueve rango; constraint de exclusión: solape parcial con buffers → rechazo; migración de datos
legacy (fixture con Turns viejos → Bookings coherentes); OTP end-to-end contra DB.

### 19. Tests de API
Todos los endpoints públicos y admin nuevos: happy path + validación + authz (sin token, token
ajeno, token usado/vencido, OTP agotado) + códigos coherentes (201/409/410/422/403/404/429).

### 20. Tests de concurrencia
N reservas concurrentes al mismo rango (idéntico y solapado) → exactamente 1;
cancelación concurrente con expiración → un solo estado final e historial único;
canje concurrente del mismo OTP → un solo consumo.

### 21. Tests E2E (Playwright)
(1) reservar servicio con seña → pagar simulado → confirmada; (2) dejar expirar → slot reaparece;
(3) cancelar por enlace de gestión; (4) recuperar enlace por OTP; (5) admin: login → agenda →
reprogramar → no-show.

### 22. Tests de seguridad
Acceso a booking ajeno por ID/token ajeno → 404/403; OTP brute-force → lockout + 429; tokens no
aparecen en logs (grep del log de test); my-turns eliminado/410; enlaces vencidos → mensaje
seguro.

### 23. Validación manual
Guion de demo actualizado (DEMO.md): reserva completa con seña, expiración observada,
recuperación OTP, agenda admin, reprogramación, no-show, notificaciones simuladas + email real
de prueba.

### 24. Criterios de aceptación binarios
- [ ] Un servicio de 45' con buffers 10'+10' genera slots correctos y bloquea solapes en DB.
- [ ] 20 requests concurrentes a rangos solapados → exactamente 1 booking activa.
- [ ] PENDING_PAYMENT sin confirmar expira a los N min configurados, queda
  CANCELLED/`PAYMENT_EXPIRED`, el slot vuelve a ofrecerse y hay notificación + historial.
- [ ] Cancelar/reprogramar sólo funciona con token de gestión válido u OTP verificado.
- [ ] Todo cambio de estado tiene fila en BookingStatusHistory con actor.
- [ ] Cada notificación WA tiene fallback email si hay email; identifica negocio, profesional,
  servicio, fecha y hora.
- [ ] E2E verdes en CI. Datos legacy migrados sin pérdida (conteos verificados).

### 25. Testeo final
Suite completa (unit+integración+API+E2E) en CI verde; migraciones aplicadas sobre copia de la
DB de producción demo; smoke manual del guion §23 en staging.

### 26. Rollback
Migraciones expand son aditivas → rollback = desplegar versión anterior (columnas extra inocuas).
El contract (F1.7) sólo tras estabilidad; su rollback es restaurar backup (documentar snapshot
previo). Flags permiten apagar seña y OTP sin redeploy.

### 27. Feature flags
`DEPOSITS_ENABLED`, `OTP_ENABLED`, `NEW_BOOKING_FLOW` (frontend, para cutover), heredado
`PUBLIC_MY_TURNS_ENABLED` se elimina en contract.

### 28. Entregables
Dominio de reservas completo y genérico; página de gestión del cliente; admin CRUD completo;
seña simulada con ciclo de vida real; notificaciones con fallback; suite E2E; docs actualizadas.

### 29. Esfuerzo
**4–6 semanas** de un dev full-time (F1.3 es el hueso: ~1.5 semanas).

### 30. Riesgo
**Medio-alto.** Mayores: migración de datos legacy (mitigada con expand-contract + fixtures),
constraint de exclusión con datos sucios (mitigada con patrón aborto+reparación F0), TZ/DST
(mitigada con tests dedicados y date-fns-tz o Temporal).

### 31. Definition of Done
Criterios §24 todos ✔, CI verde, desplegado en staging y validado con guion manual, deuda nueva
registrada, docs/00-02 actualizados, tag `f1-completa`.

---

# FASE 2 — Multitenancy y SaaS básico

### 1. Objetivo
Convertir la aplicación single-tenant en una plataforma donde cada negocio (`Business`) opera
aislado, con registro self-serve, roles OWNER/STAFF, página pública por slug y panel Dativa
inicial. El aislamiento es demostrable por tests, no una convención.

### 2. Problema actual
No existe Business; hay un solo Settings global, un solo conjunto de profesionales; los admins
son usuarios sueltos con rol; no hay registro, ni verificación de email, ni invitaciones, ni
página pública por negocio, ni auditoría, ni panel de plataforma.

### 3. Alcance
`Business` como tenant + migración de datos actuales a un **Business demo**; `businessId`
obligatorio en todos los dominios tenantizados con **filtrado obligatorio y guardrail
programático**; BusinessMember con OWNER/STAFF; registro con verificación de email; recuperación
de contraseña; invitaciones (a STAFF y a Professional sin cuenta); onboarding mínimo (crear
negocio → TZ → primer profesional/servicio → horarios → publicar); slug único y página pública
`/{slug}`; publicar/despublicar; selector de negocio si un user pertenece a varios; panel del
Business (lo de F1, tenantizado); panel Dativa inicial (listar/suspender/reactivar negocios,
métricas básicas); AuditLog; feature flags con alcance por business; migración expand-and-contract.

### 4. Fuera de alcance
Cobro de membresías (F3 — en F2 todo negocio opera "gratis"), cupones, MP señas, branding
avanzado, analíticas por plan, impersonación (descartada v1).

### 5. Dependencias
F1 completa (dominio nombrado y estable). Servicio de email real (Resend ya integrado) para
verificación/invitaciones.

### 6. Decisiones de producto aplicables
§1 completo (tenant, User/Professional/Business, OWNER/STAFF, admins Dativa separados),
§7 (TZ por Business), §12 (panel Dativa v1 sin impersonación), §13 (staging, backups), P5.

### 7. Modelo de datos
- **Business**: `name, slug unique, timezone, status(DRAFT|PUBLISHED|SUSPENDED), settings…`
  (absorbe Settings de F1 por-negocio), `createdAt/updatedAt`.
- **BusinessMember**: `businessId, userId, role(OWNER|STAFF), invitedById?, acceptedAt?` —
  unique `(businessId, userId)`.
- **User** (expand): `emailVerifiedAt?, passwordResetTokenHash?/…`; deja de tener `role` global
  de negocio (el rol vive en la membership). **PlatformAdmin**: tabla separada (o
  `User.platformRole` — decisión: tabla separada para que un breach de tenant-auth nunca
  escale a plataforma).
- **Invitation**: `businessId, email, role, professionalId? (invitar recurso a ser user),
  tokenHash, expiresAt, acceptedAt?`.
- **AuditLog**: `actorType(USER|PLATFORM_ADMIN|SYSTEM), actorId, businessId?, action,
  entityType, entityId, diff Json?, ip?, createdAt`.
- **FeatureFlag**: `key, enabled, businessId? (null = global), payload Json?`.
- `businessId` (FK, NOT NULL tras backfill) en: Professional, Service, Customer, Booking,
  TimeBlock, AvailabilityRule (vía professional, redundante explícito para el guardrail),
  NotificationLog, AnalyticsEvent, Payment (vía booking + redundante), ManagementToken (vía
  booking + redundante para validación barata).
- Unicidades tenantizadas: `(businessId, phoneE164)` en Customer, `(businessId, name)` en
  Service/Professional según convenga. La constraint de exclusión de solapes ya es por
  professional (que pertenece a un business) — sigue válida.

### 8. Migraciones
1. `f2_business_expand`: Business + BusinessMember + AuditLog + FeatureFlag + Invitation;
   crear **Business demo** con slug y TZ; backfill `businessId` en todas las tablas; convertir
   admins actuales en OWNER del demo.
2. `f2_business_contract`: NOT NULL + FKs + unicidades tenantizadas (tras verificación de
   conteos: cero filas sin businessId).
3. Scripts de verificación idempotentes (`scripts/verify-tenant-backfill.js`) que comparan
   conteos por tabla antes/después.

### 9. Backend — respuestas explícitas a las preguntas de tenancy
- **Cómo se obtiene el tenant:** (a) rutas admin/panel: del **JWT sólo sale `userId`**; el
  middleware `resolveTenant` carga las memberships y determina el business activo por el path
  (`/api/b/:businessId/admin/...`) validando membership — el ID en el path es *selección*, la
  *autoridad* es la membership en DB; (b) rutas públicas: por **slug** en el path
  (`/api/public/:slug/...`) → lookup a Business `PUBLISHED` (404 si no existe o no publicado);
  (c) plataforma: `PlatformAdmin` con JWT propio (`aud: platform`) y rutas `/api/platform/...`.
- **Cómo se propaga:** `resolveTenant` fija `req.tenant = { businessId, role }` **y** un
  `AsyncLocalStorage` (`tenantContext`) para las capas que no reciben req. Los services reciben
  `businessId` como **parámetro explícito** (la ALS es red de seguridad, no canal principal).
- **Cómo se valida:** membership activa y rol suficiente por endpoint (`requireRole('OWNER')`);
  business `SUSPENDED` → 403 en admin, 404 en público.
- **Cómo se evita olvidar filtros (guardrail Prisma):** **Prisma Client Extension** que envuelve
  todas las operaciones sobre modelos tenantizados y (1) exige `businessId` en `where`/`data`
  comparándolo con el `tenantContext` activo, (2) lanza `TenantGuardError` si falta o difiere,
  (3) lista blanca explícita de modelos globales (User, Plan, FeatureFlag global, WebhookEvent…),
  (4) bypass explícito `withoutTenantGuard()` sólo para jobs de plataforma, auditado. En test y
  dev **lanza siempre**; CI incluye un test que recorre modelos tenantizados y verifica que una
  query sin businessId explota.
- **Cómo se protege el acceso por ID:** helpers de repositorio `findForTenant(model, id)` que
  siempre filtran `{ id, businessId }` y devuelven **404** (no 403) en mismatch para no revelar
  existencia. Prohibido `findUnique({ id })` a secas en modelos tenantizados (regla ESLint
  custom simple + review).
- **Cómo se impide aceptar businessId del frontend como autoridad:** el guardrail compara
  siempre contra `tenantContext` derivado de membership/slug del servidor; cualquier
  `businessId` de body/query se ignora (validadores lo rechazan como campo desconocido).
- **Rutas públicas por slug:** slug → businessId cacheado en memoria con TTL corto; el resto
  del request opera con businessId resuelto server-side.
- **Cómo se prueban accesos cruzados:** suite genérica de aislamiento: seed A y B; para cada
  endpoint autenticado, un user de A intenta leer/mutar recursos de B por ID directo → 404;
  para públicos, recursos de B vía slug de A → 404. Tabla de endpoints mantenida en el propio
  test (falla si aparece una ruta no cubierta — se enumeran las rutas del router de Express).
- **Cómo se migran los datos single-tenant:** Business demo + backfill + verificación (ver §8).
- **Cron, SSE y notificaciones multitenant:** el expirationJob y recordatorios operan con
  queries globales (bypass auditado) pero cada fila lleva businessId y las notificaciones se
  componen con los datos del negocio de la fila; SSE: canal por negocio
  (`business:{id}:booking-created`), el token efímero incluye `businessId` y el stream sólo
  emite eventos de ese negocio.

### 10. Frontend
Registro/login/verificación/reset; onboarding wizard; selector de negocio (si >1 membership);
panel admin bajo `/b/:slug/admin` con datos del tenant; página pública `/{slug}` (catálogo +
flujo de reserva de F1); toggle publicar/despublicar; gestión de miembros e invitaciones;
panel Dativa mínimo separado (`/platform`): lista de negocios, suspender/reactivar, métricas
básicas (negocios, reservas/día).

### 11. Seguridad
Verificación de email obligatoria antes de operar; reset de contraseña con token hasheado y
expiración; invitaciones con token hasheado single-use; JWT de plataforma con audiencia
distinta (un JWT de tenant jamás valida en `/api/platform`); rate limits por IP y por slug en
rutas públicas; AuditLog en toda acción de plataforma y en acciones sensibles de OWNER
(cambios de miembros, publicación, suspensión).

### 12. Autorización y aislamiento
Matriz de permisos OWNER vs STAFF (STAFF: opera agenda y reservas; no toca miembros, servicios,
precios, publicación — configurable después). Aislamiento garantizado por guardrail + suite de
accesos cruzados (ver §9). PlatformAdmin no pertenece a tenants.

### 13. Observabilidad
AuditLog consultable en panel Dativa; métricas por tenant (reservas, errores de notificación);
logs con `businessId` en el contexto de cada request.

### 14. Subfases numeradas
- **F2.1 Modelo y guardrail**: Business/BusinessMember/migración expand + Prisma extension +
  suite de aislamiento (contra el Business demo + uno sintético).
- **F2.2 Identidad**: registro, verificación email, reset password, invitaciones, roles.
- **F2.3 Tenantización de la app**: rutas `/api/b/:businessId/admin` y `/api/public/:slug`,
  frontend panel + página pública por slug, publicar/despublicar, selector.
- **F2.4 Plataforma**: PlatformAdmin, panel Dativa v1, suspensión/reactivación, AuditLog UI.
- **F2.5 Cierre**: contract (NOT NULL), feature flags por business, E2E multitenant, docs.

### 15. Orden exacto de ejecución
F2.1 → F2.2 → F2.3 → F2.4 → F2.5 (F2.2 puede empezar en paralelo tras el modelo de F2.1).

### 16. Archivos y módulos estimados
`modules/{identity,business,platform-admin}` (~20 archivos), `shared/prisma-tenant-guard.js`,
middleware `resolveTenant`, 2-3 migraciones + scripts de verificación, suite de aislamiento,
frontend: auth screens, onboarding, selector, panel platform (~15 componentes). ~55 archivos.

### 17. Tests unitarios
Guardrail (query sin businessId lanza; con mismatch lanza; modelos globales pasan; bypass sólo
explícito); resolución de tenant por slug/membership; matriz de roles; validación de slug;
tokens de invitación/reset (hash, expiración, single-use).

### 18. Tests de integración
Migración demo (fixture single-tenant → backfill → conteos idénticos); onboarding completo crea
negocio operable; suspensión bloquea admin (403) y público (404); invitación STAFF end-to-end;
flags por business.

### 19. Tests de API
Registro/verificación/reset/invitaciones (happy + abuso); CRUD tenantizados con membership
correcta e incorrecta; rutas platform con JWT tenant → 401/403.

### 20. Tests de concurrencia
Registro simultáneo con mismo email → 1; aceptación simultánea de la misma invitación → 1;
creación simultánea de slug idéntico → 1 (unique).

### 21. Tests E2E
Registro → onboarding → publicar → reservar como cliente en `/{slug}` → operar agenda;
dos negocios en paralelo sin cruce visible; STAFF invitado con permisos limitados.

### 22. Tests de seguridad
Suite completa de accesos cruzados (lectura y mutación, por ID y por slug); JWT de tenant en
platform y viceversa; enumeración de slugs no publicados → 404; AuditLog registra lo sensible;
verificación de que el frontend nunca envía businessId con autoridad (contract tests).

### 23. Validación manual
Crear negocio real de prueba desde cero en staging (registro→publicar→reserva de un cliente
externo desde un celular) + revisar AuditLog y panel Dativa.

### 24. Criterios de aceptación binarios
- [ ] Una query Prisma sin filtro de tenant sobre modelo tenantizado falla en test/CI.
- [ ] La suite de accesos cruzados cubre el 100% de las rutas montadas y está verde.
- [ ] Los datos legacy viven en el Business demo con conteos verificados.
- [ ] Registro→onboarding→publicación→reserva funciona sin intervención manual.
- [ ] Suspender un negocio lo saca de público (404) y bloquea su panel (403).
- [ ] STAFF no puede tocar miembros/servicios/publicación (403 probado).
- [ ] Ninguna ruta acepta businessId del cliente como autoridad.

### 25. Testeo final
Suite completa + E2E multitenant en CI; migración ensayada sobre copia de producción; smoke en
staging con 2 negocios.

### 26. Rollback
Expand aditivo → redeploy anterior; contract sólo tras estabilidad con backup verificado.
La tenantización de rutas se hace con compatibilidad temporal (las rutas viejas single-tenant
redirigen al Business demo hasta el cutover, controlado por flag `MULTITENANT_ROUTES`).

### 27. Feature flags
`MULTITENANT_ROUTES` (cutover), `SELF_SERVE_SIGNUP` (permite cerrar el registro), flags por
business como mecanismo general nuevo.

### 28. Entregables
Plataforma multi-negocio con registro self-serve, aislamiento probado, página pública por slug,
panel Dativa v1 con auditoría.

### 29. Esfuerzo
**5–7 semanas** (F2.1 y su suite de aislamiento son inversión crítica: ~2 semanas).

### 30. Riesgo
**Alto** (es la fase estructural). Mitigaciones: guardrail antes que features, suite de
aislamiento como gate de CI, migración con verificación de conteos, cutover por flag.

### 31. Definition of Done
§24 completo, CI verde con suite de aislamiento como job obligatorio, staging con ≥2 negocios
reales de prueba operando una semana sin incidentes de cruce, docs actualizadas, tag `f2-completa`.

---

# FASE 3 — Membresías y monetización SaaS

### 1. Objetivo
Cobrar la plataforma: planes Basic/Premium con entitlements aplicados en backend, suscripciones
vía Mercado Pago Suscripciones (cuenta Dativa) con webhooks validados e idempotentes, período de
gracia, y motor de promociones/cupones con canje atómico y registro analítico. Sin trial
automático: lo gratuito entra por cupón.

### 2. Problema actual
Tras F2 todos los negocios operan gratis e ilimitados; no hay Plan/Subscription/Entitlements ni
integración de cobro ni cupones; Dativa no puede monetizar ni otorgar promociones controladas.

### 3. Alcance
Plan (Basic/Premium, precios parametrizados); Subscription con estados
(`INCOMPLETE, ACTIVE, PROMO, PAST_DUE (gracia), SUSPENDED, CANCELLED`) y su máquina de
transiciones; renovación/cancelación/upgrade/downgrade; SubscriptionEvent (historial);
Entitlements (por plan + overrides por business): `maxActiveProfessionals`,
`customBranding`, `advancedAnalytics`, `mpDepositsEnabled`…; límites aplicados en backend
(crear 2º profesional activo en Basic → 403 con upsell); período de gracia configurable (en
gracia: operar reservas existentes y recibir nuevas; restricciones exactas según P2);
integración MP Suscripciones (preapproval): creación, webhook firmado, idempotencia
(WebhookEvent unique por id de evento), consulta de estado como verificación, conciliación
diaria; panel Business (mi plan, medios de pago, upgrade/downgrade, historial); panel Dativa
(planes, suscripciones, extensiones manuales auditadas); motor de promociones: Campaign, Coupon
(código único, cupo, vigencia, beneficio: N meses gratis de plan X — genérico para
porcentaje/fijo futuro), CouponRedemption + BenefitGrant con **canje atómico** (transacción +
unique + lock) y registro de intentos válidos/inválidos; cupones iniciales: 1 mes Basic y 1 mes
Premium; conversión post-promo a pago (al vencer la promo: pasa a requerir método de pago con
aviso previo, no corta en seco — configurable).

### 4. Fuera de alcance
Señas con MP (F4), referidos (usarán el motor después), facturación fiscal/AFIP, self-service
de reembolsos de membresía (manual Dativa).

### 5. Dependencias
F2 (tenants, panel Dativa, AuditLog, flags). Cuenta MP de Dativa con credenciales de
suscripciones + sandbox. Definir P1 (precios) antes del go-live (no bloquea el desarrollo).

### 6. Decisiones de producto aplicables
§3 (membresía y fuente de verdad), §4 (planes), §5 (cupones, sin trial automático, motor
genérico, registro transaccional), P1, P2.

### 7. Modelo de datos
`Plan {code unique, name, priceCents, currency, interval, entitlements Json, isActive}`;
`Subscription {businessId, planId, status, currentPeriodStart/End, graceUntil?, mpPreapprovalId?,
cancelAtPeriodEnd, createdAt…}` (0..1 activa por business — unique parcial);
`SubscriptionEvent {subscriptionId, type, payload Json, createdAt}`;
`EntitlementOverride {businessId, key, value, reason, expiresAt?}`;
`Campaign {name, source?, partner?, startsAt, endsAt?, isActive}`;
`Coupon {campaignId, code unique, benefitType(FREE_MONTHS|PERCENT|FIXED), benefitValue,
planCode?, maxRedemptions, perBusinessLimit(1), validFrom/To, isActive}`;
`CouponRedemption {couponId, businessId, userId?, email?, status(APPLIED|REJECTED), reason?,
grantId?, createdAt}` (se registran también los intentos inválidos con status REJECTED);
`BenefitGrant {businessId, source(COUPON|MANUAL|REFERRAL_FUTURE), couponId?, planCode,
startsAt, endsAt, convertedToPaidAt?, cancelledAt?}`;
`WebhookEvent {provider, externalId unique, type, payload, processedAt?, error?}`.

### 8. Migraciones
Aditivas todas (dominio nuevo): `f3_billing`, `f3_promotions`, `f3_webhook_events` + seed de
planes y de los 2 cupones iniciales **desde el panel/seed parametrizado, no hardcodeados**.
Backfill: negocios existentes → BenefitGrant manual "legacy free" con vencimiento decidido por
Dativa (default propuesto: 60 días) para no cortarles el servicio al activar el cobro.

### 9. Backend
`billingService` (crear preapproval, procesar webhook → verificar firma `x-signature` + consultar
API de MP como confirmación, transiciones de Subscription, gracia, cancelación/upgrade/
downgrade con prorrateo simple: upgrade inmediato, downgrade al fin de período);
`entitlementService` (`getEntitlements(businessId)` cacheado con invalidación por evento;
`assertEntitlement(businessId, key)` usado por los services de dominio — p.ej. activar 2º
profesional); `promotionService` (validar+canjear en **una transacción**: revalida cupo con
`SELECT … FOR UPDATE`, crea Redemption+Grant, activa Subscription PROMO); job `reconcileSubscriptions`
(diario: estado MP vs local, divergencias → evento + alerta); job `expireGrants/graceWatcher`.
Rutas: `/api/b/:id/admin/billing/*`, `/api/platform/billing/*`, `POST /api/webhooks/mp/subscriptions`
(sin auth de sesión; validación por firma; 200 rápido + proceso async o sync corto).

### 10. Frontend
Business: página "Mi plan" (estado, próximos cobros, upgrade/downgrade, ingresar cupón en
onboarding o después); avisos de gracia y de promo por vencer. Dativa: CRUD de planes (precios),
campañas y cupones (crear, cupo, vigencia, desactivar), vista de suscripciones por estado,
extensiones manuales (crean BenefitGrant auditado), métricas de conversión.

### 11. Seguridad
Webhook: validación de firma + tolerancia de reloj + idempotencia por `WebhookEvent.externalId`;
nunca activar por redirect (la página de retorno sólo muestra "procesando" y consulta estado);
códigos de cupón case-insensitive normalizados, rate limit de canje por business/IP; secretos MP
sólo en env; AuditLog en toda acción manual de Dativa.

### 12. Autorización y aislamiento
Billing del business: sólo OWNER. Panel platform: sólo PlatformAdmin. Entitlements se evalúan
server-side en cada operación gateada (nunca por claims del JWT, que pueden quedar viejos).

### 13. Observabilidad
Métricas: suscripciones por estado, webhooks procesados/fallidos, divergencias de conciliación,
canjes por campaña; alerta si webhooks fallan >N seguidos o si la conciliación encuentra
divergencias.

### 14. Subfases numeradas
- **F3.1 Dominio billing**: Plan/Subscription/Events/Entitlements + gating backend (con planes
  activados manualmente desde panel Dativa — aún sin MP).
- **F3.2 Promociones**: motor de campañas/cupones/canje atómico + UI (los 2 cupones iniciales).
- **F3.3 MP Suscripciones**: preapproval + webhooks firmados idempotentes + conciliación +
  gracia + conversión promo→pago.
- **F3.4 Paneles y cierre**: panel Dativa completo, "Mi plan", E2E, analítica de conversión
  mínima (canjes → conversión → retención).

### 15. Orden exacto de ejecución
F3.1 → F3.2 → F3.3 → F3.4. (F3.2 antes que MP: permite lanzar con cupones aunque el cobro real
se retrase.)

### 16. Archivos y módulos estimados
`modules/{billing,promotions}` (~18 archivos), webhook router, 2 jobs, 3 migraciones, frontend
~10 pantallas (business + platform), tests ~15 archivos. ~50 archivos.

### 17. Tests unitarios
Máquina de estados de Subscription (todas las transiciones, gracia, cancelAtPeriodEnd);
cálculo de períodos y prorrateo; evaluación de entitlements con overrides y grants; validación
de cupones (vigencia, cupo, límite por business, plan); firma de webhook (casos válido/ inválido/
replay).

### 18. Tests de integración
Webhook duplicado → efecto único (idempotencia); webhook fuera de orden → estado final correcto;
conciliación corrige divergencia simulada; canje crea PROMO operativa end-to-end; vencimiento de
grant dispara flujo de conversión; gracia permite operar reservas y bloquea lo restringido.

### 19. Tests de API
Endpoints billing/promotions con roles correctos e incorrectos; canje de cupón inválido/vencido/
agotado → error seguro y Redemption REJECTED registrada; webhook sin firma → 401.

### 20. Tests de concurrencia
N canjes concurrentes del último cupo de un cupón → exactamente 1 APPLIED; webhooks concurrentes
del mismo evento → 1 procesamiento; activación concurrente de 2º profesional en Basic → 1 falla
403 consistente.

### 21. Tests E2E
Onboarding con cupón Premium → opera con features Premium → simular vencimiento → downgrade
efectivo visible; upgrade Basic→Premium desbloquea 2º profesional sin redeploy.

### 22. Tests de seguridad
Forjar webhook sin firma válida; activar plan manipulando el retorno del checkout (debe ser
inocuo); canje de cupón de otra campaña/business; STAFF intentando cambiar plan → 403; secretos
ausentes de logs y respuestas.

### 23. Validación manual
Ciclo completo en sandbox MP: alta → cobro → falta de pago → gracia → suspensión → reactivación;
canje de ambos cupones; extensión manual desde Dativa con AuditLog verificado.

### 24. Criterios de aceptación binarios
- [ ] Basic no puede activar un 2º profesional (403 server-side) y Premium sí.
- [ ] Ninguna suscripción se activa sin webhook validado + estado confirmado contra MP.
- [ ] Webhook repetido N veces → un solo efecto.
- [ ] Canje concurrente del último cupo → exactamente un APPLIED.
- [ ] Todos los intentos de canje (válidos e inválidos) quedan registrados con motivo.
- [ ] La gracia mantiene la operación de reservas existentes.
- [ ] Cupones administrables desde panel Dativa sin tocar código ni env.

### 25. Testeo final
Suite completa + E2E en CI; ciclo sandbox completo documentado con evidencia; conciliación
corrida contra sandbox.

### 26. Rollback
Todo detrás de `BILLING_ENFORCEMENT` (los límites se calculan y loguean en shadow-mode antes de
aplicarse — permite medir impacto y apagar sin redeploy). Dominio nuevo aditivo: rollback =
desactivar flags.

### 27. Feature flags
`BILLING_ENFORCEMENT` (shadow→enforce), `COUPONS_ENABLED`, `MP_SUBSCRIPTIONS_ENABLED`
(cupones pueden salir antes que el cobro real).

### 28. Entregables
Monetización operativa: planes, límites reales, cobro por MP, gracia, cupones administrables con
analítica de conversión, paneles Business y Dativa.

### 29. Esfuerzo
**4–6 semanas** (MP Suscripciones + conciliación: ~2).

### 30. Riesgo
**Medio-alto**: dependencia del comportamiento real de MP (mitigación: sandbox + conciliación +
shadow-mode); riesgo de cortar servicio a negocios existentes (mitigación: grants legacy +
shadow-mode + gracia).

### 31. Definition of Done
§24 completo, ciclo sandbox documentado, shadow-mode ≥1 semana sin falsos positivos antes de
enforce, docs y tag `f3-completa`.

---

# FASE 4 — Mercado Pago real para señas

### 1. Objetivo
Señas reales: cada Business Premium conecta **su** cuenta de MP por OAuth (marketplace), el
cliente paga la seña al negocio, y el estado de la reserva se deriva exclusivamente de webhooks
validados + consulta de estado. Comisión de Dativa modelada en 0%. Piloto gradual.

### 2. Problema actual
La seña es simulada (F1): confirma siempre, no mueve dinero. No hay OAuth por negocio, ni
webhooks de pagos, ni conciliación financiera, ni manejo de pagos tardíos o reembolsos.

### 3. Alcance
OAuth MP por Business (vincular/desvincular, tokens cifrados, refresh); checkout de seña
(Checkout Pro/preference por booking `PENDING_PAYMENT`); webhooks de pago firmados e
idempotentes; conciliación diaria de pagos; reembolsos **manuales** v1 con auditoría (botón en
admin que ejecuta refund vía API y registra); pagos tardíos (pago llega con booking ya expirada:
mantener CANCELLED, marcar `requiresRefund`, alertar al negocio y a Dativa); expiración
sincronizada con la preferencia MP; sandbox/test users; auditoría financiera (todo movimiento →
fila inmutable); comisión `applicationFeeBps = 0` modelada; política de desconexión (§10 de
decisiones): al desvincular MP, los servicios con seña quedan en estado "requiere decisión" —
reconectar / permitir sin seña temporalmente / no reservable; gating: sólo Premium
(`mpDepositsEnabled`); piloto con flag por business.

### 4. Fuera de alcance
Cobro del servicio completo (sólo seña), split payments/comisión real (sólo modelada), reembolsos
automáticos, facturación fiscal, otros PSP.

### 5. Dependencias
F3 (entitlement Premium, WebhookEvent, panel Dativa); app MP marketplace aprobada con OAuth;
definición P3 (comisión, queda 0%).

### 6. Decisiones de producto aplicables
§10 completo (separación membresía/seña, OAuth por business, 0% modelado, webhook fuente de
verdad, tokens cifrados, idempotencia, conciliación, reembolsos manuales, política de
desconexión), §4 (sólo Premium).

### 7. Modelo de datos
`MpConnection {businessId unique, mpUserId, accessTokenEnc, refreshTokenEnc, publicKey,
scope, status(ACTIVE|REVOKED|ERROR), connectedById, connectedAt, revokedAt?}` (cifrado
AES-256-GCM, key en env `MP_TOKEN_ENC_KEY`, rotable);
`Payment` (evoluciona el de F0/F1): `bookingId, businessId, amountCents, currency,
provider(SIMULATED|MERCADOPAGO), providerPaymentId?, preferenceId?, status(PENDING|APPROVED|
REJECTED|EXPIRED|REFUND_REQUIRED|REFUNDED), applicationFeeBps(0), payload Json?, paidAt?,
refundedAt?, refundedById?…`;
`FinancialAuditLog {businessId, paymentId, action, actorType/Id, detail Json, createdAt}`
(append-only; sin UPDATE/DELETE por convención + sin service que lo permita).

### 8. Migraciones
Aditivas: `f4_mp_connection`, `f4_payment_expand` (mapear estados actuales), `f4_financial_audit`.
Sin contract riesgoso.

### 9. Backend
`mpOAuthService` (authorize URL con `state` firmado anti-CSRF, callback → intercambio y cifrado
de tokens, refresh programado, revoke); `depositService` v2 (crear preference con
`expiration_date_to` = expiración de la seña, `external_reference` = paymentId,
`notification_url` propia); `POST /api/webhooks/mp/payments` (firma, idempotencia por
WebhookEvent, consulta `GET /v1/payments/:id` **con el token del business** como confirmación,
transición transaccional Payment+Booking+historial); `reconcilePayments` (diario, por negocio
conectado: pagos MP vs local); `refundService` (manual, audita); política de desconexión
implementada como estado de servicio (`depositBlocked: RECONNECT_REQUIRED`) con acciones
explícitas del OWNER.

### 10. Frontend
Business admin: página "Pagos" (conectar MP → OAuth redirect, estado de conexión, desvincular con
advertencia y elección explícita de política, lista de señas, botón reembolso manual con motivo);
cliente: checkout MP embebido/redirect desde el flujo de reserva, retorno "estamos confirmando tu
pago" con polling del estado real (nunca confirmación por query params). Dativa: salud de
conexiones y pagos, cola de `REFUND_REQUIRED`.

### 11. Seguridad
Tokens MP nunca en claro (cifrados at-rest, redactados en logs, ausentes de respuestas);
`state` OAuth firmado y expirable; webhooks verificados y consultados con credenciales del
business dueño; validación de que el `external_reference` pertenece al business del webhook
(anti-confusión entre tenants); reembolsos sólo OWNER + AuditLog financiero.

### 12. Autorización y aislamiento
Conectar/desvincular/reembolsar: OWNER del business. Webhook: sin sesión, autoridad = firma +
consulta API. Todo Payment lleva businessId y pasa por el guardrail de tenant.

### 13. Observabilidad
Métricas: pagos aprobados/rechazados/expirados por negocio, latencia webhook→confirmación,
divergencias de conciliación, refresh de tokens fallidos; alertas en fallos de webhook y
conexiones en ERROR.

### 14. Subfases numeradas
- **F4.1 OAuth + bóveda**: MpConnection, cifrado, conectar/desvincular, refresh, política de
  desconexión (sin cobrar aún).
- **F4.2 Checkout + webhooks**: preference, webhook firmado idempotente, transiciones reales,
  pagos tardíos, sandbox end-to-end.
- **F4.3 Conciliación + reembolsos**: jobs, cola REFUND_REQUIRED, auditoría financiera, panel.
- **F4.4 Piloto**: flag por business, 1–3 negocios reales, monitoreo, luego apertura Premium.

### 15. Orden exacto de ejecución
F4.1 → F4.2 → F4.3 → F4.4.

### 16. Archivos y módulos estimados
`modules/payments/` reescrito (~15 archivos), webhook router, 2 jobs, 3 migraciones, frontend
~8 pantallas/estados, tests ~12. ~40 archivos.

### 17. Tests unitarios
Cifrado/descifrado y rotación de key; `state` OAuth; mapeo de estados MP→dominio; política de
desconexión (matriz de 3 decisiones); cálculo de expiración de preference; validación de
external_reference↔tenant.

### 18. Tests de integración
Webhook aprobado confirma booking (con mock del API MP); duplicado → un efecto; tardío →
REFUND_REQUIRED sin resucitar la reserva; conciliación detecta pago faltante; desvinculación
bloquea nuevos checkouts pero no la gestión de reservas existentes.

### 19. Tests de API
OAuth callback con state inválido → 403; webhook sin firma → 401; refund sin rol → 403;
endpoints de conexión con Basic → 403 (entitlement).

### 20. Tests de concurrencia
Webhook + expiración simultáneos sobre el mismo Payment → estado final único y consistente;
doble clic en reembolso → un solo refund.

### 21. Tests E2E
(sandbox) Reserva con seña real → pago test → confirmada; abandono → expira y libera; reembolso
manual completo.

### 22. Tests de seguridad
Tokens cifrados en DB (test lee la fila y verifica no-claro); logs sin tokens; webhook de un
business no afecta bookings de otro; retorno del checkout manipulado no confirma nada.

### 23. Validación manual
Ciclo sandbox completo con cuenta de prueba de vendedor y comprador; simulacro de desconexión
con las 3 decisiones; reembolso real en sandbox.

### 24. Criterios de aceptación binarios
- [ ] Ninguna reserva se confirma sin webhook validado + payment APPROVED confirmado contra MP.
- [ ] Tokens MP ilegibles en DB y ausentes de logs/respuestas.
- [ ] Pago tardío nunca resucita una reserva expirada; genera REFUND_REQUIRED visible.
- [ ] Desconectar MP no convierte servicios a "sin seña" silenciosamente.
- [ ] Todo movimiento financiero tiene fila de auditoría inmutable.
- [ ] Sólo Premium puede conectar MP (gate backend probado).

### 25. Testeo final
Suite + sandbox E2E; piloto con negocios reales ≥2 semanas con conciliación limpia antes de
apertura general.

### 26. Rollback
`MP_DEPOSITS_ENABLED` global y por business; apagar vuelve a seña simulada/sin seña según
configuración del servicio, sin tocar datos; los Payments reales quedan intactos.

### 27. Feature flags
`MP_DEPOSITS_ENABLED` (global + por business, para el piloto).

### 28. Entregables
Señas reales end-to-end con OAuth por negocio, conciliación, reembolsos auditados y piloto
validado.

### 29. Esfuerzo
**4–5 semanas** + 2 semanas de piloto.

### 30. Riesgo
**Alto** (dinero real de terceros): mitigado por sandbox, idempotencia, conciliación, piloto
gradual, auditoría financiera y 0% de comisión inicial (sin split real).

### 31. Definition of Done
§24 completo, piloto sin divergencias de conciliación ni pérdida de fondos, runbook de
incidentes de pago escrito, tag `f4-completa`.

---

# FASE 5 — Analíticas, personalización y escala

### 1. Objetivo
Analíticas reales gateadas por plan (Basic operativa / Premium avanzada / Dativa global),
personalización visual completa con storage abstraído, y la base operativa para escalar:
observabilidad, backups probados, scheduler robusto con colas y soporte multi-instancia.

### 2. Problema actual
AnalyticsEvent existe pero mezcla datos demo y no es multitenant-aware por diseño; el dashboard
actual es de demo; no hay branding por negocio; cron y SSE son in-process (una instancia);
no hay Sentry/alertas ni backups probados ni tests de rendimiento.

### 3. Alcance
**Analíticas**: AnalyticsEvent real (businessId, type tipado, refs, metadata) emitido desde los
services de dominio; embudo (page_view → slot_selected → booking_created → confirmed →
completed/no_show); rollups diarios (`AnalyticsDailyRollup` por business/professional/service);
gating backend por plan; panel Basic (reservas totales/confirmadas/canceladas/no-show, ocupación
básica, top servicios, clientes nuevos vs recurrentes, comparación con período anterior);
panel Premium (todo Basic + embudo real, ingresos y señas, evolución de no-show, ocupación por
profesional, heatmap de demanda, retención, métricas por servicio, efectividad de recordatorios,
comparativas avanzadas, exportación CSV); Dativa global (negocios registrados/activos/publicados,
suscripciones por estado, MRR e ingresos, conversión de promociones, retención post-cupón, uso
por plan, salud de webhooks/pagos/WhatsApp/email, errores y operación).
**Personalización**: logo, portada, imágenes, colores, textos con preview; validación de
contraste accesible (WCAG AA); sanitización de textos; validación de imágenes (tipo, dimensiones,
peso, re-encode); storage R2/S3-compatible detrás de `StoragePort` (upload firmado, URLs
públicas versionadas).
**Escala/operación**: Sentry (o equivalente) backend+frontend; alertas (health, webhooks, colas);
backups automatizados + **restore drill documentado y ejecutado**; scheduler robusto y colas con
**pg-boss** (sobre PostgreSQL — fundamento: evita infra nueva (Redis), da reintentos/backoff/
locks distribuidos suficientes a esta escala; se re-evalúa BullMQ+Redis si el volumen lo exige);
migración de cron in-process a jobs pg-boss (recordatorios, expiraciones, conciliaciones,
rollups); SSE multi-instancia vía Postgres LISTEN/NOTIFY como pub/sub (misma fundamentación);
la app queda stateless y soporta ≥2 instancias; tests de rendimiento (k6: disponibilidad y
creación de reservas bajo carga).

### 4. Fuera de alcance
Data warehouse/BI externo, ML, apps móviles, temas/plantillas de página complejos, SLA formales.

### 5. Dependencias
F3 (planes para gating, MRR), F4 (ingresos de señas para analítica financiera). La parte de
escala (colas, observabilidad) puede adelantarse si la operación lo pide.

### 6. Decisiones de producto aplicables
§4 y §11 (analíticas por nivel y personalización), §11 (storage abstraído), §13
(observabilidad progresiva, backups probados), separación Basic/Premium/Dativa del anexo
"Analíticas por nivel" (abajo).

### 7. Modelo de datos
`AnalyticsEvent` v2 (businessId NOT NULL, type enum-like tipado, professionalId?, serviceId?,
bookingId?, metadata Json, occurredAt, índices por (businessId, type, occurredAt));
`AnalyticsDailyRollup {businessId, date, professionalId?, serviceId?, metrics Json}` unique por
dimensión; `BusinessBranding {businessId unique, logoKey?, coverKey?, colors Json, texts Json,
updatedById}`; `StorageObject {businessId, key, kind, mime, bytes, width?, height?, createdAt}`;
jobs/colas: tablas de pg-boss (schema propio).

### 8. Migraciones
Aditivas (`f5_analytics_v2`, `f5_branding`, `f5_pgboss`); limpieza de eventos demo (script
explícito que borra los tagueados por seed-demo); backfill de rollups desde eventos históricos
reales.

### 9. Backend
`analyticsService` (emisión tipada desde dominio — nunca desde el frontend para métricas de
negocio; el frontend sólo aporta page_view/slot_selected vía endpoint público rate-limited),
`rollupJob` (nocturno + on-demand), `reportingService` (consultas por plan con `assertEntitlement`),
export CSV streaming; `brandingService` (validación de contraste — cálculo de ratio WCAG —,
sanitización HTML/textos con lista blanca, pipeline de imagen: validar → re-encode → subir vía
StoragePort); `StoragePort` con adapter R2/S3 (sdk v3) y adapter local para dev/test;
migración de todos los crons a pg-boss con reintentos/backoff y métricas; `ssePubSub` sobre
LISTEN/NOTIFY; Sentry SDK con scrubbing de tokens/PII.

### 10. Frontend
Dashboard Basic y Premium (gating desde el backend: el endpoint responde sólo lo permitido y el
frontend renderiza lo que llega — no al revés); export CSV; editor de branding con preview en
vivo y validación de contraste visible; página pública consume branding; panel Dativa global
con las métricas de §3; estados de salud (webhooks, colas, canales).

### 11. Seguridad
Uploads: sólo OWNER, tipos permitidos, límite de tamaño, re-encode server-side (mata payloads),
keys no adivinables, sin ejecución de SVG (rasterizar o sanitizar); export CSV con escape
anti-fórmula; eventos públicos rate-limited y sin PII; Sentry sin tokens/PII (scrubbers
probados).

### 12. Autorización y aislamiento
Reporting siempre por businessId del contexto + entitlement por plan; export sólo Premium;
métricas globales sólo PlatformAdmin; branding sólo OWNER.

### 13. Observabilidad
Sentry con release tracking; alertas: health 503, cola atascada, webhook fallando, job sin
correr en ventana esperada, divergencia de conciliación; dashboard operativo mínimo (Railway
metrics + panel Dativa salud); runbooks (pago caído, WA caído, restore).

### 14. Subfases numeradas
- **F5.1 Colas y scheduler** (pg-boss + migración de crons + SSE pub/sub + multi-instancia).
- **F5.2 Observabilidad y backups** (Sentry, alertas, backup + restore drill).
- **F5.3 Analíticas** (eventos v2 + rollups + paneles Basic/Premium + gating + export).
- **F5.4 Dativa global** (métricas de plataforma + salud de canales/pagos).
- **F5.5 Personalización** (storage + branding + preview + accesibilidad).
- **F5.6 Rendimiento** (k6, índices, tuning, prueba con 2 instancias).

### 15. Orden exacto de ejecución
F5.1 → F5.2 → F5.3 → F5.4 → F5.5 → F5.6. (F5.1/F5.2 primero: son la base operativa; pueden
adelantarse a F4 si la operación lo exige.)

### 16. Archivos y módulos estimados
`modules/analytics` reescrito (~12), `modules/business/branding` (~8), `shared/{queue,storage,
observability}` (~10), jobs migrados (~6), frontend ~15 componentes, k6 scripts, runbooks.
~60 archivos.

### 17. Tests unitarios
Cálculo de métricas y rollups (fixtures deterministas); ratio de contraste; sanitización;
validación de imágenes; mapeo de eventos; scrubbing de Sentry.

### 18. Tests de integración
Rollup incremental correcto vs cálculo directo; jobs pg-boss con reintento tras fallo simulado;
LISTEN/NOTIFY entrega SSE entre dos procesos; StoragePort adapter local y mock S3; export CSV
de dataset grande (streaming sin OOM).

### 19. Tests de API
Endpoints de reporting con Basic vs Premium (campos gateados); export sólo Premium; upload con
tipos inválidos → 422; branding de otro tenant → 404.

### 20. Tests de concurrencia
Rollup concurrente del mismo día → unique respeta un resultado; dos instancias procesando la
misma cola sin duplicar envíos (locks de pg-boss); doble upload simultáneo de branding →
consistente.

### 21. Tests E2E
Dashboard Basic vs Premium con seeds distintos; editar branding → preview → página pública
refleja; export CSV descarga válida.

### 22. Tests de seguridad
Upload malicioso (polyglot, SVG con script, imagen gigante) rechazado; CSV injection; eventos
públicos con spam → rate limit; PII ausente en Sentry (test de scrubber).

### 23. Validación manual
Restore drill completo documentado (backup → restore en staging → verificación de conteos);
simulacro de caída de canal WA (fallback email visible); panel Dativa con datos reales de
staging; carga k6 y lectura de resultados.

### 24. Criterios de aceptación binarios
- [ ] Un job fallido se reintenta con backoff y alerta al agotar reintentos.
- [ ] La app corre con 2 instancias: SSE, colas y recordatorios sin duplicados ni pérdidas.
- [ ] Restore de backup probado end-to-end y documentado (fecha + evidencia).
- [ ] Basic no recibe (ni por API) métricas Premium.
- [ ] MRR y conversión de promociones visibles y correctos contra datos de control.
- [ ] Branding con contraste insuficiente es rechazado con explicación.
- [ ] k6: p95 de disponibilidad y reserva dentro del presupuesto definido (a fijar en F5.6,
  propuesta: p95 < 500 ms a 50 RPS de lectura de slots).

### 25. Testeo final
Suite completa + k6 + drill de restore + 1 semana de operación multi-instancia en staging.

### 26. Rollback
Cada pieza con flag (`QUEUE_ENGINE=cron|pgboss`, `ANALYTICS_V2`, `BRANDING_ENABLED`); volver a
cron in-process es config; branding apagable sin afectar reservas.

### 27. Feature flags
Los de §26 + `SSE_PUBSUB`.

### 28. Entregables
Plataforma observable, escalable a multi-instancia, con backups probados, analíticas reales por
plan, personalización completa y métricas de plataforma para Dativa.

### 29. Esfuerzo
**6–8 semanas** (paralelizable en partes si hay 2 devs).

### 30. Riesgo
**Medio**: piezas independientes y flaggeadas; el mayor riesgo es operativo (migrar crons a
colas sin perder ejecuciones — mitigado con periodo de doble-corrida en shadow).

### 31. Definition of Done
§24 completo, staging multi-instancia estable 1 semana, runbooks escritos, tag `f5-completa`.

---

## Anexo — Analíticas por nivel (separación inicial obligatoria)

**Basic (operativas):** reservas totales / confirmadas / canceladas / no-show; ocupación básica;
servicios más reservados; clientes nuevos y recurrentes básicos; comparación simple con el
período anterior.

**Premium (todo Basic más):** embudo real; ingresos y señas; evolución de no-show; ocupación por
profesional; heatmap de demanda; retención; métricas por servicio; efectividad de recordatorios;
comparativas avanzadas; exportación.

**Dativa (plataforma):** negocios registrados / activos / publicados; suscripciones por estado;
MRR e ingresos; conversión de promociones; retención después del cupón; uso por plan; salud de
webhooks; salud de pagos; salud de WhatsApp/email; errores y operación global.

El gating es **backend** (el API de reporting decide por entitlement qué series devuelve).

## Dependencias entre fases

```
F0 (aprobada) → F1 → F2 → F3 → F4 → F5
                          └────────→ F5.1/F5.2 (colas/observabilidad) pueden adelantarse
```
F2 no arranca sin el dominio F1 estable; F3 exige tenants y panel Dativa (F2); F4 exige
entitlements (F3); F5.3+ exige F3/F4 para métricas de dinero. Staging separado desde F2 a más
tardar.

## Estrategia de testing global

- **Pirámide por fase:** unit (lógica pura, sin DB) → integración (Postgres real, serial) →
  API (supertest) → concurrencia (Promise.allSettled + constraints) → E2E (Playwright) →
  seguridad (suite de aislamiento + abuso) — los seis niveles son obligatorios en cada fase
  (§17–§22 de cada una).
- **CI:** los seis niveles como jobs; la suite de aislamiento multitenant es gate desde F2;
  E2E como job requerido desde F1.7.
- **Datos:** factories/fixtures por módulo; seeds demo separados y tagueados; nunca depender de
  datos demo en tests.
- **Convención F0 heredada:** migraciones nunca reparan datos silenciosamente — abortan con
  reporte y hay script de reparación auditable aparte.

## Riesgos generales

| Riesgo | Mitigación |
|---|---|
| Migraciones sobre datos productivos (F1.3, F2.1) | Expand-and-contract, ensayo sobre copia, verificación de conteos, backups previos |
| Aislamiento multitenant incompleto | Guardrail Prisma + suite de accesos cruzados como gate de CI |
| Dependencia de MP (2 integraciones distintas) | Sandbox, idempotencia, conciliación, shadow-mode, piloto |
| Un solo dev / bus factor | Esta documentación + runbooks + PRs con descripción |
| Fechas/TZ (strings legacy → timestamptz) | Tests de DST, TZ por business, migración con doble columna |
| Cron/SSE single-instance hasta F5 | Riesgo aceptado y documentado; F5.1 lo elimina |
| Scope creep de paneles | Criterios binarios por fase; lo no listado es fuera de alcance |

## Definition of Done global (toda fase y toda feature)

1. Backend con autorización y persistencia real (nada "sólo pantalla").
2. Tests de los seis niveles pertinentes verdes en CI.
3. Sin secretos/tokens/PII en logs ni respuestas.
4. Migraciones reversibles o con plan de rollback escrito.
5. Feature flag si hay riesgo de rollback funcional.
6. Documentación actualizada (estos tres docs + README).
7. Desplegado y validado en staging antes de producción.
8. AuditLog para acciones administrativas sensibles (desde F2).

## Preguntas pendientes (no bloquean el arranque de F1)

Las P1–P6 de [00_DECISIONES_PRODUCTO.md](./00_DECISIONES_PRODUCTO.md#decisiones-pendientes-no-bloquean-f1),
más: presupuesto de rendimiento definitivo (F5.6) y fecha objetivo de staging separado (recomendado:
antes de cerrar F2).
