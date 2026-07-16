# Auditoría de Fase 0 — Estabilización y seguridad

> **Fecha:** 2026-07-16 · **Auditor:** sesión de auditoría técnica (Claude Code) sobre el fork
> `GiordVan/Turnero-ITCracks`, rama `main`.
> **Método:** lectura exhaustiva de código + ejecución real de instalación, migraciones, tests,
> lint, builds y pruebas dinámicas contra un PostgreSQL 18.4 efímero local (puerto 5433).
> Cada afirmación indica su nivel de evidencia: **[VALIDADO]** (ejecutado y observado),
> **[LECTURA]** (verificado sólo por lectura de código), **[BLOQUEADO]** (no ejecutable en este
> entorno), **[CI]** (evidenciado por GitHub Actions).

---

## 1. Estado de Git

- Rama: `main`, sincronizada con `origin/main` (`GiordVan/Turnero-ITCracks`). Working tree
  **limpio** al inicio; sin merge/rebase/cherry-pick incompletos. **[VALIDADO]**
- Remotes: `origin` = fork GiordVan; `upstream` = `ElLicha123/Turnero-ITCracks`.
- F0 existe como los commits `7f7e6b4` (F0.1) → `1c96084` (F0.2) → `4ba0bae` (F0.3) →
  `fba9e22` (F0.4) → `b735095` (F0.5) → `dccaf18`, `8833c2a` (build/docs), mergeados a `main`
  vía PR #1 (`7c20f78`). CI de GitHub Actions **verde** en `main` y en la rama F0. **[CI]**
- Diff total de F0: 51 archivos, +3359/−173 — sin reformateo masivo. **[VALIDADO]**

## 2. Stack real (verificado en manifests y lockfiles)

| Capa | Tecnología | Versión |
|---|---|---|
| Runtime | Node.js | >=20 (local: 22.12.0) |
| Backend | Express | 5.2.x |
| ORM | Prisma + @prisma/client | **6.19.3 (pineado exacto)** |
| DB | PostgreSQL | 16 en CI · 18.4 en validación local |
| Auth | jsonwebtoken 9 + bcryptjs 3 | roles ADMIN/EMPLOYEE |
| Seguridad | helmet 8 (CSP explícita), express-rate-limit 8, express-validator 7 | |
| Tests | Vitest 2 + Supertest 7 | unit y integración separados |
| Lint/format | ESLint 10 (flat config) + Prettier 3 (desacoplados) | |
| Frontend | React 19, Vite 8, Tailwind 4, React Router 7, Recharts 3, axios | |
| Cron | node-cron (in-process) | recordatorios c/15 min |
| Email | Resend (opcional) · WhatsApp: Evolution API (modo simulado por defecto) | |
| Deploy | Railway single-service (Express sirve `frontend/dist`) + NIXPACKS | |

## 3. Arquitectura y funcionalidades actuales

**Arquitectura:** monorepo `backend/` + `frontend/`; API Express en capas
(routes → validación → controllers → services → Prisma) con singleton Prisma **lazy**
([backend/src/lib/prisma.js](../backend/src/lib/prisma.js)); SPA React consumiendo `/api`;
en producción el backend sirve el build del frontend (mismo origen).

**Funcionalidades reales (recorrido Frontend → API → autorización → servicio → Prisma →
PostgreSQL → respuesta → UI → tests verificado):**
- Reserva pública por profesional/fecha/hora con agendas independientes por profesional.
- Panel admin (JWT): agenda diaria, config (duración de turno, días laborales), bandas horarias,
  notificaciones, dashboard de analítica, campana SSE en vivo.
- Recordatorio programado (cron 15 min, idempotente por `reminderSentAt`).
- Gestión de reserva del cliente por **token de gestión firmado** (cancelar / seña).

**Funcionalidades simuladas (explícitamente):**
- **Seña**: `PAYMENT_PROVIDER=simulated` — `confirmDeposit` siempre aprueba. Sin dinero real.
- **WhatsApp**: `WHATSAPP_MODE=simulated` — registra el mensaje en `NotificationLog`
  (status `SIMULATED`) sin enviarlo. Modo `live` pega a Evolution API.
- **Analítica demo**: `seed-demo.js` fabrica ~3 meses de historia; el dashboard mezcla datos
  reales y sembrados.

**Modelo de datos actual:** single-tenant. `User`, `Service` (sin precio/buffers, no usado por
el flujo de reserva), `Professional`, `AdminConfig` (singleton), `WorkBand` global, `Turn`
(estados WAITING/CALLED/IN_PROGRESS/COMPLETED/CANCELLED/NO_SHOW; `scheduledDate/Time` como
strings), `Payment`, `NotificationLog`, `AnalyticsEvent`. 8 migraciones. Sin Business, sin
Customer, sin disponibilidad por profesional — esperado; es el punto de partida de F1/F2.

**Deuda técnica principal (no bloquea F0):** fechas/horas como strings sin TZ; `Service`
desconectado del flujo de reserva; WorkBand global (no por profesional); cron/SSE in-process
(no escala a multi-instancia); baseline de Prettier incompleta (12 archivos backend);
4 warnings de lint en frontend (react-hooks v7); frontend `MisTurnosPage` contiene un flujo
muerto (ver §6, O-2).

## 4. Verificación por subfase

### F0.1 — Tests reproducibles y CI — **CUMPLE**

| Criterio | Evidencia | Nivel |
|---|---|---|
| Tests unitarios sin exportar variables | `npm test` → **51/51 pass** out-of-the-box; [test/setup.js](../backend/test/setup.js) inyecta defaults seguros | [VALIDADO] |
| Prisma sin efectos de carga al importar | Proxy lazy en [lib/prisma.js](../backend/src/lib/prisma.js); instancia recién al primer acceso | [VALIDADO] |
| Validación de config al iniciar, no al importar | `validateConfig()` bajo `require.main === module` en [app.js:62](../backend/src/app.js#L62) | [VALIDADO] |
| ESLint 10 flat config válida | `npm run lint` backend y frontend → exit 0 | [VALIDADO] |
| ESLint/Prettier desacoplados | Sin `eslint-plugin-prettier`; `eslint-config-prettier` sólo desactiva conflictos | [VALIDADO] |
| Sin reformateo masivo | Diff F0 = +3359/−173 en 51 archivos, mayormente tests/config nuevos | [VALIDADO] |
| `lint` bloqueante / `format:check` informativo | CI: lint gate, prettier `continue-on-error` ([ci.yml](../.github/workflows/ci.yml)) | [VALIDADO][CI] |
| Lockfiles reproducibles | `npm ci` backend y frontend → exit 0, working tree sin cambios | [VALIDADO] |
| CI backend+frontend con Postgres de testing | Workflow con service postgres:16, migrate deploy + integración; runs verdes en GitHub | [CI] |
| Docs para correr tests localmente | README §Tests (unit vs integración) coincide con la realidad | [VALIDADO] |
| Build monorepo reproducible | `npm run build` raíz → exit 0, manifests intactos | [VALIDADO] |

### F0.2 — Prevención atómica de doble reserva — **CUMPLE**

| Criterio | Evidencia | Nivel |
|---|---|---|
| La DB es la garantía definitiva | Índice único **parcial** `Turn_active_slot_unique` sobre `(scheduledDate, scheduledTime, professionalId) WHERE status <> 'CANCELLED'` ([migración 20260713120000](../backend/prisma/migrations/20260713120000_turn_active_slot_unique/migration.sql)) | [VALIDADO] |
| Cancelados no bloquean el slot | Test de integración "un turno CANCELLED no bloquea" pass; índice parcial excluye CANCELLED | [VALIDADO] |
| Chequeo previo no es la única defensa | Comentario y estructura en [public.service.js:64-77](../backend/src/services/public.service.js#L64-L77); P2002 → 409 | [VALIDADO] |
| Creación transaccional | `$transaction` para número secuencial + insert | [VALIDADO] |
| Unicidad → 409 seguro | En vivo: segunda reserva del mismo slot → **409** con mensaje amigable | [VALIDADO] |
| Test de integración vs PostgreSQL real | [booking-concurrency.test.js](../backend/test/integration/booking-concurrency.test.js): **20 requests concurrentes → exactamente 1 reserva, 19×409** — pass local y en CI | [VALIDADO] |
| Migración no modifica datos y aborta con reporte | Simulado en vivo: DB con 2 duplicados activos → migración **abortó** con mensaje que apunta a los scripts; datos intactos | [VALIDADO] |
| Reparación separada, explícita, auditable, idempotente | `db:duplicates:report` (solo lectura) y `db:duplicates:repair` (dry-run por defecto, `--apply` cancela soft con nota `DUP_REPAIR <ISO>`, transaccional; re-ejecución → "nada para hacer"; grupos con >1 seña PAGADA → conflicto manual) — todo ejecutado y observado | [VALIDADO] |

**Nota sobre el predicado del índice:** excluye sólo `CANCELLED`. Con los estados actuales es
correcto y conservador (COMPLETED/NO_SHOW ocurren después del horario; que bloqueen su slot
pasado es inocuo). **Al introducir los estados F1** (`PENDING_PAYMENT`, `PAYMENT_EXPIRED` como
motivo de cancelación) la política se mantiene: todo lo no-cancelado retiene el slot. Revisitar
el predicado en cada migración de estados (riesgo conocido: `prisma migrate dev` puede proponer
eliminar el índice; rechazar — está advertido en el schema).

### F0.3 — Rate limiting, config segura, health y errores — **CUMPLE**

| Criterio | Evidencia | Nivel |
|---|---|---|
| Rate limit login | En vivo: 7 intentos → `401×5, 429, 429`. Default 5/15 min | [VALIDADO] |
| Rate limit públicos | `publicLimiter` (30/min default) sobre todo el router público | [VALIDADO — aplicado; umbral por lectura] |
| Config por env | [config/index.js](../backend/src/config/index.js) centraliza todo; [.env.example](../backend/.env.example) completo | [VALIDADO] |
| `JWT_SECRET` fuerte obligatorio en prod | `validateConfig`: ≥32 chars en producción; test unitario pass | [VALIDADO] |
| `CORS_ORIGIN` obligatorio en prod | `validateConfig` lanza si falta; test unitario pass | [VALIDADO] |
| CSP explícita | helmet con directivas explícitas en [app.js:24-35](../backend/src/app.js#L24-L35) | [LECTURA] |
| Sin secretos en respuestas | login/me excluyen `password`; errores 5xx → "Internal Server Error" genérico | [VALIDADO] |
| `/api/health` con DB real | En vivo: DB arriba → **200 `db:up`**; PostgreSQL detenido → **503 `db:down`**; restaurada → 200 | [VALIDADO] |
| Errores Prisma no filtrados | `errorHandler`: 5xx loguea server-side y responde genérico (stack sólo en development) | [VALIDADO] |
| Códigos HTTP coherentes | 201/409/422/403/404/410/401/429 observados en vivo según el caso | [VALIDADO] |
| `trust proxy` correcto | `app.set('trust proxy', config.trustProxy)`, default 1 (Railway), configurable | [LECTURA] |
| Sin defaults inseguros en prod | Defaults de dev inocuos; prod exige secretos vía `validateConfig` | [VALIDADO] |

### F0.4 — Protección interina de reservas — **CUMPLE**

| Criterio | Evidencia | Nivel |
|---|---|---|
| No consultar turnos sólo con email | `GET /public/my-turns` → **410** (feature flag `PUBLIC_MY_TURNS_ENABLED=false` por defecto), observado en vivo y en test de integración | [VALIDADO] |
| Cancelar exige token de gestión | En vivo: sin token → **422**; token falso/ajeno → **403**; token válido → **200 CANCELLED** | [VALIDADO] |
| Seña no depende del email del cliente | `createDeposit`/`confirmDeposit` verifican `manageToken` contra el turno | [VALIDADO — por integración y lectura] |
| Token vinculado a reserva concreta | HMAC sobre `{tid, exp}`; `verify(token, turnId)` exige coincidencia; test unitario "no verifica contra turnId distinto" pass | [VALIDADO] |
| Propósito y expiración | Expira en hora del turno + 24 h; vencido → rechazo (test pass) | [VALIDADO] |
| Firma sólo en backend | HMAC-SHA256 con `MANAGE_TOKEN_SECRET` o `JWT_SECRET`; `timingSafeEqual` | [VALIDADO] |
| No aparece completo en logs | Viaja en response body y request body (morgan sólo loguea URL); claves sensibles de query redactadas | [VALIDADO] |
| Errores de token seguros | 422/403 con mensajes no filtrantes, observados | [VALIDADO] |
| Claramente interina | Comentarios explícitos en [manageToken.js](../backend/src/lib/manageToken.js) y controller: F1 = tokens persistidos hasheados + OTP | [VALIDADO] |

### F0.5 — SSE con token efímero y logs — **CUMPLE** (tras corrección de H-1, aprobada e incluida en el commit de cierre)

| Criterio | Evidencia | Nivel |
|---|---|---|
| JWT principal no viaja por query | `authenticateSse` **rechaza** el JWT principal (sin `purpose:'sse'`) → 401, observado en vivo y en test | [VALIDADO] |
| Existe token SSE efímero | `POST /api/admin/sse-token` (auth por header) emite JWT con `purpose:'sse'`, TTL 60 s | [VALIDADO] |
| Vencimiento corto | `SSE_TOKEN_TTL=60s`; test verifica `exp-iat ≤ 120` | [VALIDADO] |
| **Propósito exclusivo / no autentica otros endpoints** | Falla original (H-1): token efímero como `Bearer` en `GET /api/admin/config` → 200. **Corregido**: `authenticate` rechaza tokens con claim `purpose`; nuevo test de integración → **401**, suite 13/13 verde | [VALIDADO — falla demostrada y corrección validada] |
| URLs sensibles redactadas en logs | En vivo: log muestra `?token=REDACTED`; el secreto crudo aparece 0 veces; tests pass | [VALIDADO] |
| Tests de estas propiedades | [sse-auth.test.js](../backend/test/integration/sse-auth.test.js) + [logRedact.test.js](../backend/test/logRedact.test.js) + [manageToken.test.js](../backend/test/manageToken.test.js) | [VALIDADO] |
| Frontend pide token nuevo antes de abrir stream | [NotificationBell.jsx:44-47](../frontend/src/components/NotificationBell.jsx#L44-L47): `getSseToken()` → `EventSource` | [LECTURA] |
| Riesgo residual de reconexión documentado | **Pendiente de documentar** — resuelto en este documento (§6, O-1) | — |

## 5. Registro de comandos ejecutados (todos el 2026-07-16, entorno Windows 11 / Node 22.12.0)

| # | Comando | Resultado |
|---|---|---|
| 1 | `git status` / `git branch -a` / `git remote -v` / `git log` | limpio, main, sin ops incompletas |
| 2 | `npm ci` (backend) | exit 0, lockfile intacto |
| 3 | `npm ci` (frontend) | exit 0, lockfile intacto |
| 4 | `npx prisma generate` | Prisma Client 6.19.3 generado |
| 5 | `npx prisma migrate deploy` sobre PostgreSQL 18.4 **limpia** (efímera, :5433) | 8/8 migraciones aplicadas |
| 6 | `npm test` (backend, unit) | **51 pass / 0 fail** (9 archivos, 1.5 s) |
| 7 | `npm run test:integration` | **12 pass / 0 fail** (4 archivos: concurrencia, api-security, gestión, sse) |
| 8 | `npm run lint` (backend) | exit 0, sin errores |
| 9 | `npm run lint` (frontend) | exit 0, 0 errores, 4 warnings (react-hooks, deuda declarada) |
| 10 | `npm run format:check` (backend) | 12 archivos con diferencias — **informativo**, coherente con baseline pendiente |
| 11 | `npm run build` (frontend) | exit 0, dist generado |
| 12 | `npm run build` (raíz, camino Railway) | exit 0, working tree sin cambios |
| 13 | Health en vivo con DB arriba / abajo / restaurada | 200 `db:up` / **503 `db:down`** / 200 |
| 14 | Reserva normal en vivo (`POST /public/turns`) | 201 + `manageToken` |
| 15 | Mismo slot otra vez | **409** |
| 16 | 20 requests concurrentes al mismo slot (test integración) | **exactamente 1 reserva**, 19×409 |
| 17 | Cancelar sin token / token ajeno / token válido | 422 / 403 / 200 |
| 18 | `my-turns` por email | 410 |
| 19 | Login ×7 con credenciales inválidas | 401×5 luego **429** |
| 20 | SSE: sin token / JWT principal / token efímero | 401 / 401 / **200 text/event-stream** |
| 21 | Token efímero SSE como Bearer en `/api/admin/config` | **200 — HALLAZGO H-1 (debía ser 401)** |
| 22 | Inspección de logs del server en vivo | secreto ausente, `token=REDACTED` presente |
| 23 | Migración del índice sobre DB con duplicados activos | **abortó** con mensaje claro, sin tocar datos |
| 24 | `db:duplicates:report` / `repair` dry-run / `--apply` / re-`--apply` | reporte correcto / no toca nada / cancela 1 con nota auditable / idempotente |
| 25 | `git diff --check` | sin problemas de whitespace |

**Bloqueado por infraestructura:** ninguno (Docker no estaba disponible pero se sustituyó con
un cluster PostgreSQL 18.4 efímero local; CI además lo cubre con PostgreSQL 16).
**No verificable en este entorno:** comportamiento real en Railway (trust proxy = 1 con su edge,
CSP en producción servida) — mitigado por lectura y por el deploy demo existente.

## 6. Hallazgos

### H-1 · El token efímero de SSE autenticaba otros endpoints admin — **SEVERIDAD MEDIA** — ✅ CORREGIDO (aprobación del PO 2026-07-16)

- **Hallazgo:** el token SSE (`purpose:'sse'`, TTL 60 s) es un JWT firmado con el mismo
  `JWT_SECRET`, y el middleware general [`authenticate`](../backend/src/middleware/auth.middleware.js#L4-L20)
  no inspecciona el claim `purpose`. Resultado: un token pensado sólo para abrir el stream sirve
  como Bearer en cualquier endpoint admin durante su ventana de vida.
- **Evidencia:** comando #21 — `GET /api/admin/config` con `Authorization: Bearer <sseToken>` →
  **200** (esperado 401). Reproducible.
- **Impacto:** el token efímero viaja en query string (superficie de exposición: historial del
  navegador, referrers, logs de intermediarios que no controlamos — los propios se redactan).
  Si se filtra, el atacante obtiene hasta 60 s de **API admin completa** en lugar de sólo
  lectura del stream. No hay escalación de privilegios (emitirlo ya requiere un JWT admin);
  la ventana es corta. Contradice el criterio explícito de F0.5 "no permite autenticarse en
  otros endpoints".
- **Corrección aplicada (mínima, no rompe sesiones existentes):** en
  [`authenticate`](../backend/src/middleware/auth.middleware.js) se rechaza todo token que
  traiga claim `purpose` (los JWT de sesión no lo llevan) → 401.
- **Archivos modificados:** `backend/src/middleware/auth.middleware.js` (guardia) y
  `backend/test/integration/sse-auth.test.js` (nuevo test: token efímero como Bearer en
  `/api/admin/config` → **401**).
- **Re-validación:** lint OK; unit **51/51**; integración **13/13** (incluye el test nuevo y
  todo el flujo SSE previo); builds OK. Estado: **cerrado**, incluido en el commit
  `Fase 0: Estandarización`.

### Observaciones menores (no bloquean; deuda registrada)

- **O-1 · Reconexión del SSE (riesgo residual funcional, documentado acá como exige F0.5):**
  ante un error del stream el frontend hace `es.close()` y **no** re-pide token ni reintenta
  ([NotificationBell.jsx:55](../frontend/src/components/NotificationBell.jsx#L55)). Tras un corte
  (deploy, red), la campana deja de recibir eventos hasta recargar la página. Sin impacto de
  seguridad. Se resuelve en F1 (reconexión con re-fetch de token efímero).
- **O-2 · Flujo muerto en `MisTurnosPage`:** `handleCancel` llama `cancelTurn(id, email)` —
  pasaría el email como token (403 garantizado). Es **inalcanzable** hoy porque `my-turns`
  responde 410 y nunca se renderiza la lista. Limpiar cuando F1 reemplace la página por el
  enlace de gestión.
- **O-3 · Prettier baseline incompleta:** 12 archivos backend difieren del estilo. Decisión F0
  deliberada (evitar reformateo masivo); `format:check` es informativo. Normalizar en una tarea
  dedicada.
- **O-4 · `stack` en respuestas de error en development:** por diseño sólo con
  `NODE_ENV=development`; verificado que producción responde genérico.

## 7. Riesgos residuales aceptados en F0 (se resuelven en F1+)

1. Token de gestión **stateless** (HMAC, no persistido): no revocable individualmente y
   multi-uso hasta vencer. Interino declarado; F1 lo reemplaza por tokens persistidos hasheados
   single-use + OTP.
2. `my-turns` deshabilitado (410) degrada UX del cliente que perdió su token: sin recuperación
   hasta OTP en F1.
3. Cron y SSE in-process: un deploy corta streams y puede saltear un ciclo de recordatorios;
   no escala a >1 instancia. F5 lo resuelve (scheduler robusto / colas).
4. Rate limiting en memoria por instancia (aceptable con 1 instancia Railway).
5. Fechas/horas como strings sin TZ: correcto para single-tenant AR; F1 introduce TZ por
   Business y tipos apropiados.

## 8. Conclusión binaria

> ## **F0: APROBADA** ✅ (2026-07-16)
>
> La auditoría inicial detectó un único bloqueante (**H-1**, criterio F0.5 "propósito
> exclusivo"). Con aprobación explícita del product owner se aplicó la corrección mínima
> (+ test de integración) y se re-validó la fase completa:
>
> - Lint backend: OK · Lint frontend: OK (0 errores, 4 warnings de deuda declarada)
> - Tests unitarios: **51/51** · Tests de integración: **13/13** (incluye el test nuevo de H-1)
> - Build frontend: OK · Build raíz (camino Railway): OK · `git diff --check`: OK
>
> Todos los criterios de F0.1–F0.5 cumplen con evidencia ejecutada. El cierre queda registrado
> en el commit `Fase 0: Estandarización` (documentación reconstruida + corrección H-1 + test).
