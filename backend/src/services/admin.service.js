const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CONFIG_ID = 'singleton';

// ── Config ──────────────────────────────────────────────────────────────────

const parseConfig = (cfg) => ({
  ...cfg,
  workingDays: JSON.parse(cfg.workingDays ?? '[1,2,3,4,5]'),
});

const getConfig = async () => {
  const config = await prisma.adminConfig.findUnique({ where: { id: CONFIG_ID } });
  if (!config) {
    const created = await prisma.adminConfig.create({
      data: { id: CONFIG_ID, turnDuration: 30, workingDays: '[1,2,3,4,5]' },
    });
    return parseConfig(created);
  }
  return parseConfig(config);
};

const updateConfig = async (updates) => {
  const data = {};
  if (updates.turnDuration !== undefined) data.turnDuration = updates.turnDuration;
  if (updates.workingDays !== undefined) data.workingDays = JSON.stringify(updates.workingDays);

  const result = await prisma.adminConfig.upsert({
    where: { id: CONFIG_ID },
    update: data,
    create: { id: CONFIG_ID, turnDuration: 30, workingDays: '[1,2,3,4,5]', ...data },
  });
  return parseConfig(result);
};

// ── Work Bands ───────────────────────────────────────────────────────────────

const listWorkBands = async () => {
  return prisma.workBand.findMany({
    orderBy: [{ sortOrder: 'asc' }, { startTime: 'asc' }],
  });
};

const createWorkBand = async ({ label, startTime, endTime, sortOrder }) => {
  validateBandTimes(startTime, endTime);
  return prisma.workBand.create({
    data: { label, startTime, endTime, sortOrder: sortOrder ?? 0 },
  });
};

const updateWorkBand = async (id, { label, startTime, endTime, isActive, sortOrder }) => {
  await findWorkBandOrFail(id);
  if (startTime && endTime) validateBandTimes(startTime, endTime);
  return prisma.workBand.update({
    where: { id },
    data: { label, startTime, endTime, isActive, sortOrder },
  });
};

const deleteWorkBand = async (id) => {
  await findWorkBandOrFail(id);
  return prisma.workBand.delete({ where: { id } });
};

// ── Daily Turns ───────────────────────────────────────────────────────────────

const getDailyTurns = async (dateStr) => {
  const date = dateStr ?? new Date().toLocaleDateString('sv-SE');
  return prisma.turn.findMany({
    where: { scheduledDate: date },
    orderBy: { scheduledTime: 'asc' },
  });
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function validateBandTimes(startTime, endTime) {
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    const error = new Error('endTime must be after startTime');
    error.statusCode = 422;
    throw error;
  }
}

async function findWorkBandOrFail(id) {
  const band = await prisma.workBand.findUnique({ where: { id } });
  if (!band) {
    const error = new Error('Work band not found');
    error.statusCode = 404;
    throw error;
  }
  return band;
}

module.exports = {
  getConfig,
  updateConfig,
  listWorkBands,
  createWorkBand,
  updateWorkBand,
  deleteWorkBand,
  getDailyTurns,
};
