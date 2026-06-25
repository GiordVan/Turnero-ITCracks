const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { sendNotification } = require('../lib/notifications');

// ── Recordatorios programados ───────────────────────────────────────────────
//
// Un cron in-process corre cada 15 min, busca turnos próximos que todavía no
// fueron recordados y manda un WhatsApp (sendNotification). Idempotente: solo se setea
// reminderSentAt DESPUÉS de un envío exitoso, así un fallo se reintenta el
// próximo ciclo y nunca se manda dos veces.
//
//   cron 15m ──► turnos activos, con WhatsApp, reminderSentAt=null
//                       │ selectDueTurns(now, windowHours)
//                       ▼
//             por cada turno: sendNotification(turn)  ── falla ─► no setea, reintenta
//                       │ ok
//                       ▼
//                 set reminderSentAt = now()

const ACTIVE_STATUSES = ['WAITING', 'CALLED'];
const DEFAULT_WINDOW_HOURS = 24;

// Pure: ¿este turno debe recordarse ahora? (sin tocar DB ni red → testeable)
function isDue(turn, now, windowHours) {
  if (turn.reminderSentAt) return false;
  if (!turn.phone) return false;
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

// Envío del recordatorio por WhatsApp (modo simulado registra el mensaje).
async function sendReminderNotification(turn) {
  await sendNotification({ turn, type: 'REMINDER' });
}

// Orquestador. deps inyectables (db, send, now) para poder testear sin DB ni red.
async function runReminders({
  now = new Date(),
  windowHours = DEFAULT_WINDOW_HOURS,
  send = sendReminderNotification,
  db = prisma,
} = {}) {
  const candidates = await db.turn.findMany({
    where: { reminderSentAt: null, status: { in: ACTIVE_STATUSES }, phone: { not: null } },
    include: { professional: { select: { name: true } } },
  });

  const due = selectDueTurns(candidates, now, windowHours);
  let sent = 0;
  for (const turn of due) {
    try {
      await send(turn);
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
