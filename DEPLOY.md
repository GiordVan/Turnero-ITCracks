# Deploy a Railway (1 servicio)

Arquitectura: **un solo servicio**. El backend Express sirve `/api` y, en producción,
también el build del frontend (`frontend/dist`). Una URL, sin CORS. Postgres gestionado
de Railway. El cron de recordatorios corre dentro del proceso Node (siempre prendido).

```
[ Railway service ]
  Nixpacks build:  npm run build   (build front + install back + prisma generate)
  start:           npm run start   → prisma migrate deploy && node backend/src/app.js
                                      │
        Express ── /api/*  ──────────┤  rutas API
                └─ resto (GET) ──────┘  index.html del SPA (frontend/dist)

[ Railway Postgres ]  → DATABASE_URL
```

## Requisitos
- Cuenta en Railway + CLI (ya instalado: `railway 4.44.0`).
- En el repo: `package.json` raíz, `railway.json`, y la migración `add_professionals` (ya están).

## Pasos

1. **Login** (abre el navegador, va en tu cuenta):
   ```
   ! railway login
   ```

2. **Crear proyecto** (desde la raíz del repo):
   ```
   railway init
   ```

3. **Agregar Postgres** (provisiona la base y expone DATABASE_URL):
   ```
   railway add --database postgres
   ```

4. **Variables del servicio.** DATABASE_URL la referenciás desde el Postgres
   (en el dashboard: Variables → Add Reference → Postgres.DATABASE_URL). El resto:
   ```
   railway variables --set "NODE_ENV=production" --set "JWT_SECRET=PONÉ_UN_SECRETO_LARGO"
   # opcionales (recordatorio por email):
   railway variables --set "RESEND_API_KEY=re_xxx" --set "REMINDER_FROM=Turnero <onboarding@resend.dev>"
   ```
   > NODE_ENV=production es lo que activa el servir el frontend desde Express.

5. **Deploy** (sube y buildea con railway.json):
   ```
   railway up
   ```
   En el arranque corre `prisma migrate deploy` → crea las tablas (incluida Professional).

6. **Dominio público**:
   ```
   railway domain
   ```

7. **Seed inicial (una sola vez)** — crea admin + peluqueros (Carlos/Nico).
   El seed BORRA turnos/servicios/peluqueros, así que corrélo solo la primera vez.
   Necesita deps locales del backend e inyecta la DATABASE_URL de Railway:
   ```
   npm --prefix backend install
   railway run npm --prefix backend run db:seed
   ```

Listo: entrá a la URL del dominio. Reserva pública en `/kiosko/reservar`.
Admin: `admin@turnero.com` / `admin1234` (cambiá la clave después de la demo).

## Notas / posibles ajustes
- Los nombres exactos de algunos flags del CLI pueden variar por versión; usá
  `railway <comando> --help` si alguno no matchea.
- **CSP:** `backend/src/app.js` ya define una CSP explícita de Helmet (permite las
  fuentes de Google y estilos inline; el resto queda en `'self'`). No hace falta
  apagarla. Si agregás assets de otros orígenes, ampliá las directivas ahí.
- El build usa `npm ci` (instalación reproducible desde los lockfiles). Requiere
  que `package-lock.json` esté completo y en sync con `package.json` (lo está).
  En producción, `NODE_ENV=production` exige además `JWT_SECRET` >= 32 caracteres
  y `CORS_ORIGIN` definido (si no, el arranque falla con un mensaje claro).
- Recordatorio: sin `RESEND_API_KEY` el cron corre igual pero no manda mails (los saltea).
