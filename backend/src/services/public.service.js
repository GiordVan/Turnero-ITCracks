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

  // Chequeo aplicativo: da un 409 amigable en el caso común (slot ya tomado),
  // sin depender de una carrera. NO es la garantía: dos requests concurrentes
  // pueden pasar ambos este chequeo. La garantía real es el índice único parcial
  // "Turn_active_slot_unique" a nivel DB (ver migración 20260713120000).
  const conflict = await db.turn.findFirst({
    where: { scheduledDate, scheduledTime, professionalId, status: { not: 'CANCELLED' } },
  });
  if (conflict) {
    throw slotTakenError();
  }

  // Número secuencial + creación dentro de una transacción. Si dos requests
  // corren en paralelo, el índice único hace fallar el INSERT del segundo con
  // P2002; lo traducimos al mismo 409 amigable en lugar de un 500.
  let turn;
  try {
    turn = await db.$transaction(async (tx) => {
      const lastTurn = await tx.turn.findFirst({
        where: { scheduledDate },
        orderBy: { number: 'desc' },
      });
      return tx.turn.create({
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
    });
  } catch (err) {
    if (err.code === 'P2002') {
      throw slotTakenError();
    }
    throw err;
  }

  notificationEmitter.emit('new-turn', turn);
  return turn;
};

function slotTakenError() {
  const err = new Error('Ese horario ya fue reservado con ese peluquero. Elegí otro.');
  err.statusCode = 409;
  return err;
}

// ── My turns ──────────────────────────────────────────────────────────────────
const getMyTurns = async (email) => {
  return prisma.turn.findMany({
    where: { email: email.toLowerCase().trim() },
    orderBy: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }],
    include: { professional: { select: { id: true, name: true } } },
  });
};

// ── Cancel turn ───────────────────────────────────────────────────────────────
const cancelTurn = async (id, email) => {
  const turn = await prisma.turn.findUnique({ where: { id } });
  if (!turn) {
    const err = new Error('Turno no encontrado');
    err.statusCode = 404;
    throw err;
  }
  if (email && turn.email && turn.email.toLowerCase() !== email.toLowerCase()) {
    const err = new Error('No estás autorizado a cancelar este turno.');
    err.statusCode = 403;
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
