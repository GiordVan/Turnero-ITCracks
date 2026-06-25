const prisma = require('../lib/prisma');
const notificationEmitter = require('./notifications');

// ── Public config (working days) ──────────────────────────────────────────────
const getPublicConfig = async () => {
  const config = await prisma.adminConfig.findUnique({ where: { id: 'singleton' } });
  return { workingDays: JSON.parse(config?.workingDays ?? '[1,2,3,4,5]') };
};

// ── Professionals ─────────────────────────────────────────────────────────────
const listProfessionals = async () => {
  return prisma.professional.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });
};

// ── Available slots (POR profesional) ──────────────────────────────────────────
// La disponibilidad es por peluquero: el 10:30 reservado con uno NO bloquea el
// 10:30 con otro. Por eso el filtro de reservados incluye professionalId.
// db inyectable (default = singleton) para poder testear sin base de datos.
const getAvailableSlots = async (dateStr, professionalId, db = prisma) => {
  const config = await db.adminConfig.findUnique({ where: { id: 'singleton' } });
  const duration = config?.turnDuration ?? 30;

  const bands = await db.workBand.findMany({
    where: { isActive: true },
    orderBy: { startTime: 'asc' },
  });

  // Generar todos los slots posibles
  const allSlots = [];
  for (const band of bands) {
    let current = toMinutes(band.startTime);
    const end = toMinutes(band.endTime);
    while (current + duration <= end) {
      allSlots.push(fromMinutes(current));
      current += duration;
    }
  }

  // Restar los ya reservados PARA ESE profesional (no cancelados)
  const booked = await db.turn.findMany({
    where: { scheduledDate: dateStr, professionalId, status: { not: 'CANCELLED' } },
    select: { scheduledTime: true },
  });
  const bookedSet = new Set(booked.map((t) => t.scheduledTime));

  return allSlots.filter((s) => !bookedSet.has(s));
};

// ── Create turn (CON profesional) ───────────────────────────────────────────────
const createTurn = async ({ customerName, email, phone, scheduledDate, scheduledTime, professionalId }, db = prisma) => {
  // El peluquero debe existir y estar activo
  const professional = await db.professional.findUnique({ where: { id: professionalId } });
  if (!professional || !professional.isActive) {
    const err = new Error('El peluquero seleccionado no está disponible.');
    err.statusCode = 422;
    throw err;
  }

  // Verificar que el slot siga disponible PARA ESE profesional
  const conflict = await db.turn.findFirst({
    where: { scheduledDate, scheduledTime, professionalId, status: { not: 'CANCELLED' } },
  });
  if (conflict) {
    const err = new Error('Ese horario ya fue reservado con ese peluquero. Elegí otro.');
    err.statusCode = 409;
    throw err;
  }

  // Número secuencial por día
  const lastTurn = await db.turn.findFirst({
    where: { scheduledDate },
    orderBy: { number: 'desc' },
  });

  const turn = await db.turn.create({
    data: {
      number: (lastTurn?.number ?? 0) + 1,
      customerName,
      email,
      phone,
      scheduledDate,
      scheduledTime,
      professionalId,
      status: 'WAITING',
    },
  });

  notificationEmitter.emit('new-turn', turn);
  return turn;
};

// ── My turns ──────────────────────────────────────────────────────────────────
const getMyTurns = async (email) => {
  return prisma.turn.findMany({
    where: { email: email.toLowerCase().trim() },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    include: { professional: { select: { id: true, name: true } } },
  });
};

// ── Cancel turn ───────────────────────────────────────────────────────────────
const cancelTurn = async (id) => {
  const turn = await prisma.turn.findUnique({ where: { id } });
  if (!turn) {
    const err = new Error('Turno no encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (!['WAITING', 'CALLED'].includes(turn.status)) {
    const err = new Error('Este turno no se puede cancelar');
    err.statusCode = 409;
    throw err;
  }
  return prisma.turn.update({ where: { id }, data: { status: 'CANCELLED' } });
};

// ── Admin: daily turns (por scheduledDate) ────────────────────────────────────
const getDailyTurns = async (dateStr) => {
  const date = dateStr ?? new Date().toLocaleDateString('sv-SE');
  return prisma.turn.findMany({
    where: { scheduledDate: date },
    orderBy: { scheduledTime: 'asc' },
  });
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function toMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function fromMinutes(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

module.exports = { getPublicConfig, listProfessionals, getAvailableSlots, createTurn, cancelTurn, getMyTurns, getDailyTurns };
