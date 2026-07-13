# TODOS — Turnero

Items considerados y diferidos durante /plan-eng-review (2026-06-03). Fase 2 salvo que se promueva.

## Diferidos (fase 2 / post-demo)

### Panel admin CRUD de peluqueros
- **What:** UI en admin para crear/editar/desactivar peluqueros.
- **Why:** Que el dueño gestione su equipo sin tocar el seed.
- **Context:** Para el MVP demo los 2 peluqueros (padre e hijo) entran por `prisma/seed.js`. El modelo `Professional` ya existe; falta service/controller/routes admin + página.
- **Depends on:** Modelo Professional (T1 del plan).

### E2E del flujo de reserva (Playwright)
- **What:** Test E2E: reservar con un peluquero y verificar la agenda.
- **Why:** Confianza en el flujo UI completo para la demo.
- **Context:** El core queda cubierto con unitarios Vitest (T6). E2E suma Playwright + fixtures.
- **Depends on:** Frontend del feature (T5).

### WhatsApp Business API (recordatorio automático)
- **What:** Enviar confirmación/recordatorio por WhatsApp automático.
- **Why:** El peluquero y el cliente viven en WhatsApp; es el canal de mayor impacto.
- **Context:** MVP usa email (Resend) + link wa.me manual. WhatsApp API requiere aprobación y costo.
- **Depends on:** Subsistema de recordatorio (T4).

### Horario laboral por peluquero
- **What:** Cada peluquero con su propia disponibilidad horaria.
- **Why:** Padre e hijo pueden tener horarios distintos.
- **Context:** MVP usa bandas horarias globales (WorkBand). Pasar a horario por profesional.
- **Depends on:** Modelo Professional (T1).

### Multi-tenancy (SaaS self-serve)
- **What:** Cada negocio con su propio turnero aislado; signup self-serve + pago.
- **Why:** La visión SaaS ("la gente arma, paga y usa").
- **Context:** MVP es single-tenant para la demo (decisión del design doc). Requiere modelo Organization/Tenant y aislamiento de datos.

### Seña / MercadoPago
- **What:** Cobrar seña al reservar para reducir plantones.
- **Why:** Refuerzo anti-no-show.
- **Context:** Para la demo basta confirmación + recordatorio. Integrar MercadoPago en fase 2.
