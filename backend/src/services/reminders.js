const cron = require('node-cron');
const prisma = require('../lib/prisma');

// ── Recordatorios programados ───────────────────────────────────────────────
//
// Un cron in-process corre cada 15 min, busca turnos próximos que todavía no
// fueron recordados y manda un email (Resend). Idempotente: solo se setea
// reminderSentAt DESPUÉS de un envío exitoso, así un fallo se reintenta el
// próximo ciclo y nunca se manda dos veces.
//
//   cron 15m ──► turnos activos, con email, reminderSentAt=null
//                       │ selectDueTurns(now, windowHours)
//                       ▼
//             por cada turno: sendEmail(turn)  ── falla ─► no setea, reintenta
//                       │ ok
//                       ▼
//                 set reminderSentAt = now()

const ACTIVE_STATUSES = ['WAITING', 'CALLED'];
const DEFAULT_WINDOW_HOURS = 24;

// Pure: ¿este turno debe recordarse ahora? (sin tocar DB ni red → testeable)
function isDue(turn, now, windowHours) {
  if (turn.reminderSentAt) return false;
  if (!turn.email) return false;
  if (!ACTIVE_STATUSES.includes(turn.status)) return false;
  if (!turn.scheduledDate || !turn.scheduledTime) return false;
  const when = new Date(`${turn.scheduledDate}T${turn.scheduledTime}:00`);
  if (Number.isNaN(when.getTime())) return false;
  const ms = when.getTime() - now.getTime();
  return ms >= 0 && ms <= windowHours * 3600 * 1000;
}

// Pure: filtra la lista de candidatos a los que realmente toca recordar.
function selectDueTurns(turns, now, windowHours = DEFAULT_WINDOW_HOURS) {
  return turns.filter((t) => isDue(t, now, windowHours));
}

// Envío real vía Resend. Lanza si no hay API key (no seteamos reminderSentAt).
async function sendReminderEmail(turn) {
  if (!process.env.RESEND_API_KEY) {
    const err = new Error('RESEND_API_KEY no configurada');
    err.skipSilently = true;
    throw err;
  }
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const profe = turn.professional?.name ? ` con ${turn.professional.name}` : '';
  await resend.emails.send({
    from: process.env.REMINDER_FROM || 'Turnero <onboarding@resend.dev>',
    to: turn.email,
    subject: `Recordatorio: tu turno${profe} el ${turn.scheduledDate} a las ${turn.scheduledTime}`,
    text: `Hola ${turn.customerName || ''}, te recordamos tu turno${profe} el ${turn.scheduledDate} a las ${turn.scheduledTime}. Si no podés asistir, avisanos.`,
  });
}

// Orquestador. deps inyectables (db, sendEmail, now) para poder testear sin DB ni red.
async function runReminders({
  now = new Date(),
  windowHours = DEFAULT_WINDOW_HOURS,
  sendEmail = sendReminderEmail,
  db = prisma,
} = {}) {
  const candidates = await db.turn.findMany({
    where: { reminderSentAt: null, status: { in: ACTIVE_STATUSES }, email: { not: null } },
    include: { professional: { select: { name: true } } },
  });

  const due = selectDueTurns(candidates, now, windowHours);
  let sent = 0;
  for (const turn of due) {
    try {
      await sendEmail(turn);
      await db.turn.update({ where: { id: turn.id }, data: { reminderSentAt: new Date() } });
      sent += 1;
    } catch (err) {
      // No seteamos reminderSentAt → se reintenta el próximo ciclo.
      if (!err.skipSilently) {
        console.error(`[reminders] error enviando recordatorio (turno ${turn.id}):`, err.message);
      }
    }
  }
  return sent;
}

function start() {
  cron.schedule('*/15 * * * *', () => {
    runReminders().catch((e) => console.error('[reminders] ciclo falló:', e.message));
  });
  console.log('[reminders] cron de recordatorios activo (cada 15 min)');
}

module.exports = { start, runReminders, selectDueTurns, isDue, ACTIVE_STATUSES };
