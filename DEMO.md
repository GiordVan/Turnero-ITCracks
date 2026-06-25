# Guion de demo — Turnero para barbería

Sistema de reservas con **seña** (anti-plantón) y **recordatorio por WhatsApp**, con un **dashboard** que muestra el impacto en plata. Para la demo, la seña y el WhatsApp están en **modo simulado** (no se mueve dinero ni se envía WhatsApp real).

## Preparar
```
# Backend (siembra historia demo + arranca)
cd backend && npm run db:seed-demo && npm start
# Frontend (otra terminal)
cd frontend && npm run dev
```
- Admin: `admin@turnero.com` / `admin1234`
- `WHATSAPP_MODE=simulated` y `PAYMENT_PROVIDER=simulated` en `backend/.env`.

## 1. El problema (30 s)
"Hoy perdés plata con los que reservan y no vienen (plantones), y gestionás todo a mano por WhatsApp."

## 2. Reservar como cliente (2 min) → `/kiosko/reservar`
1. Elegí peluquero (Carlos o Nico) → fecha → horario.
2. Cargá nombre, email y **WhatsApp**.
3. Pantalla de **seña**: "para confirmar dejás $2.500 de seña" → **Pagar seña** (simulado).
4. Turno confirmado. → *La seña hace que el cliente venga.*

## 3. El WhatsApp que sale solo (1 min) → `/admin/notificaciones`
- Mostrá el mensaje de **confirmación** que se "envió" por WhatsApp al reservar.
- En producción esto sale por **Evolution API** al número real; acá está en modo demo.

## 4. El recordatorio automático
- Un cron manda el **recordatorio** antes del turno; el cliente confirma respondiendo.
- Mostrá los recordatorios en el panel de mensajes.

## 5. El dashboard — la plata (2 min) → `/admin/dashboard`
- **Ausentismo 34% → 7%** desde que usa el sistema.
- **74%** de los clientes **confirman por WhatsApp**.
- **$657.500** cobrados en **señas**.
- **93%** de los clientes **vuelven**.
- "Esto es lo que el sistema te devuelve."

## Cierre
"Seña + recordatorio = menos plantones, más plata, y vos no gestionás nada a mano."
