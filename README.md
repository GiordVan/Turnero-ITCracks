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

```bash
cd backend
npm test                      # Vitest: disponibilidad/reserva por profesional + recordatorio
```

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
