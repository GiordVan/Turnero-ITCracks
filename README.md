# Turnero

Sistema de turnos online para **peluquerías**. MVP para demos: el cliente reserva
con un peluquero específico a una hora, cada peluquero ve su agenda, y un
recordatorio automático apunta a reducir los plantones (no-shows).

🔗 **Demo en vivo:** https://turnero-web-production.up.railway.app
(reserva pública en `/kiosko/reservar` · admin en `/login`)

> Estado: MVP single-tenant (un negocio) para mostrar a clientes. La visión es un
> SaaS self-serve multi-rubro; el roadmap está en [`TODOS.md`](./TODOS.md).

---

## Qué hace

- **Reserva pública**: elegís peluquero → fecha → horario → tus datos. Las agendas
  son **independientes por peluquero** (el 10:30 con uno no bloquea el 10:30 con otro).
- **Panel admin**: agenda del día filtrable por peluquero, login con JWT.
- **Recordatorio programado**: un cron in-process busca turnos próximos y manda un
  email (Resend), una sola vez por turno.

## Novedades v2 (seña + WhatsApp + analítica)

- **Seña simulada (pluggable):** al reservar, el cliente paga una seña para confirmar. Arquitectura lista para enchufar MercadoPago real (`PAYMENT_PROVIDER=simulated|mercadopago`, `DEPOSIT_AMOUNT`).
- **Recordatorio/confirmación por WhatsApp (Evolution API):** confirmación al reservar + recordatorio programado. `WHATSAPP_MODE=simulated` (demo, registra el mensaje sin enviarlo) o `live` (pega a Evolution API: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`). Panel admin "Mensajes enviados" en `/admin/notificaciones`.
- **Dashboard de conversión** (`/admin/dashboard`): no-show antes/después del sistema, recordatorios confirmados, ingresos por seña, clientes recurrentes y ocupación por peluquero. Corte de "lanzamiento" configurable con `ANALYTICS_LAUNCH_DATE`.

### Datos demo
- `cd backend && npm run db:seed-demo` — siembra ~3 meses de historia (idempotente, tagueada, con backup previo en `backend/backups/`).
- `npm run db:cleanup-demo` — borra la historia demo.

### Variables de entorno nuevas (ver backend/.env.example)
`PAYMENT_PROVIDER`, `DEPOSIT_AMOUNT`, `DEPOSIT_CURRENCY`, `WHATSAPP_MODE`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `ANALYTICS_LAUNCH_DATE`.

### Deuda de seguridad conocida — resuelta en F0 (estabilización)
- ✅ Rate limiting en login y endpoints públicos (`express-rate-limit`).
- ✅ Doble reserva imposible a nivel DB (índice único parcial + reserva atómica).
- ✅ `GET /public/my-turns` por email deshabilitado; la gestión usa token firmado (OTP en F1).
- ✅ SSE con token efímero dedicado (el JWT principal no viaja por query) + redacción de tokens en logs.
- ✅ `JWT_SECRET` ≥ 32 y `CORS_ORIGIN` obligatorios en producción; CSP explícita; health con chequeo de DB.

Pendiente (fases siguientes): OTP/tokens persistidos para clientes (F1), aislamiento multitenant (F2).

## Stack

| Capa | Tecnología |
|------|-----------|
| Backend | Node + Express 5 + Prisma 6 (PostgreSQL) |
| Frontend | React 19 + Vite + Tailwind 4 + React Router 7 |
| Auth | JWT + bcrypt (roles ADMIN / EMPLOYEE) |
| Recordatorios | node-cron + Resend |
| Deploy | Railway (1 servicio: Express sirve el build del front) |

## Estructura

```
.
├── backend/            # API Express + Prisma
│   ├── prisma/         # schema, migraciones, seed
│   └── src/
│       ├── lib/        # prisma singleton
│       ├── routes/  controllers/  services/   # auth, admin, public, reminders
│       └── app.js      # arranque + sirve el front en producción
├── frontend/           # SPA React (Vite)
│   └── src/
│       ├── pages/      # Kiosko, Reservar, MisTurnos, Login, admin/*
│       └── api/        # cliente axios
├── package.json        # orquesta el build del monorepo (para Railway)
├── railway.json        # config de deploy
└── DEPLOY.md           # guía de deploy paso a paso
```

## Correr en local

Necesitás una base **PostgreSQL** (local o gestionada).

### Backend
```bash
cd backend
cp .env.example .env          # completá DATABASE_URL y JWT_SECRET
npm install
npx prisma migrate dev        # crea las tablas
npm run db:seed               # admin + peluqueros (Carlos, Nico)
npm run dev                   # API en http://localhost:3000
```

`.env` mínimo:
```
DATABASE_URL="postgresql://user:pass@host:5432/turnero?schema=public"
JWT_SECRET="un-secreto-largo"
# opcional (recordatorios por email):
RESEND_API_KEY=
REMINDER_FROM="Turnero <onboarding@resend.dev>"
```

### Frontend
```bash
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxea /api al backend)
```

**Admin de prueba (del seed):** `admin@turnero.com` / `admin1234`

## Tests

**Unitarios** (rápidos, sin base de datos — funcionan out-of-the-box):

```bash
cd backend
npm test                      # Vitest: disponibilidad, reserva, seña, token de gestión,
                              # recordatorio, config, rate limit, redacción de logs...
```

**Integración / API** (requieren una PostgreSQL de testing con las migraciones aplicadas):

```bash
# levantá una Postgres (p.ej. la de docker-compose) y apuntá DATABASE_URL a una base de testing
docker compose -f docker-compose.dev.yml up -d
export DATABASE_URL="postgresql://turnero:turnero@localhost:5432/turnero?schema=public"
export JWT_SECRET="un-secreto-de-al-menos-32-caracteres-para-testing"
cd backend
npm run test:integration      # concurrencia (doble reserva), health, rate limit, gestión por token, SSE
```

CI (GitHub Actions, `.github/workflows/ci.yml`) corre lint + unit + migraciones + integración + build
en cada push/PR. El lint es gate obligatorio; `npm run format:check` (Prettier) queda informativo hasta
una normalización de formato dedicada (la baseline del código existente todavía no está completa).

> Nota de seguridad (F0): la consulta pública de turnos por email está deshabilitada por defecto
> (`PUBLIC_MY_TURNS_ENABLED=false`); la gestión de un turno usa un token firmado que se entrega al
> reservar. En producción, `JWT_SECRET` debe tener ≥ 32 caracteres y `CORS_ORIGIN` es obligatorio.

## Deploy

Desplegado en Railway como **un solo servicio** (el backend sirve el build del
frontend en producción). Pasos completos en [`DEPLOY.md`](./DEPLOY.md). Redeploy:
`railway up` desde la raíz.

## Cómo trabajamos (equipo)

- Rama por feature desde `main`: `git checkout -b feat/mi-cambio`
- Commits estilo conventional: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- PR a `main` para revisión:
  ```bash
  gh pr create -R itcrackss/turnero --base main
  ```
  > El `-R itcrackss/turnero` es necesario si tenés el remote `upstream` al repo original.

## Roadmap (fase 2)

Ver [`TODOS.md`](./TODOS.md): panel CRUD de peluqueros, WhatsApp API para recordatorios,
horario por peluquero, multi-tenancy (SaaS self-serve), seña con MercadoPago, tests E2E.
