const { PrismaClient } = require('@prisma/client');
const notificationEmitter = require('./notifications');

const prisma = new PrismaClient();

// ── Public config (working days) ──────────────────────────────────────────────
const getPublicConfig = async () => {
  const config = await prisma.adminConfig.findUnique({ where: { id: 'singleton' } });
  return { workingDays: JSON.parse(config?.workingDays ?? '[1,2,3,4,5]') };
};

// ── Available slots ───────────────────────────────────────────────────────────
const getAvailableSlots = async (dateStr) => {
  const config = await prisma.adminConfig.findUnique({ where: { id: 'singleton' } });
  const duration = config?.turnDuration ?? 30;

  const bands = await prisma.workBand.findMany({
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

  // Restar los ya reservados (no cancelados)
  const booked = await prisma.turn.findMany({
    where: { scheduledDate: dateStr, status: { not: 'CANCELLED' } },
    select: { scheduledTime: true },
  });
  const bookedSet = new Set(booked.map((t) => t.scheduledTime));

  return allSlots.filter((s) => !bookedSet.has(s));
};

// ── Create turn ───────────────────────────────────────────────────────────────
const createTurn = async ({ customerName, email, scheduledDate, scheduledTime }) => {
  // Verificar que el slot siga disponible
  const conflict = await prisma.turn.findFirst({
    where: { scheduledDate, scheduledTime, status: { not: 'CANCELLED' } },
  });
  if (conflict) {
    const err = new Error('Ese horario ya fue reservado. Elegí otro.');
    err.statusCode = 409;
    throw err;
  }

  // Número secuencial por día
  const lastTurn = await prisma.turn.findFirst({
    where: { scheduledDate },
    orderBy: { number: 'desc' },
  });

  const turn = await prisma.turn.create({
    data: {
      number: (lastTurn?.number ?? 0) + 1,
      customerName,
      email,
      scheduledDate,
      scheduledTime,
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

module.exports = { getPublicConfig, getAvailableSlots, createTurn, cancelTurn, getMyTurns, getDailyTurns };
