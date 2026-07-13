const prisma = require('../src/lib/prisma');

(async () => {
  const seeded = await prisma.turn.findMany({ where: { notes: 'SEED_DEMO' }, select: { id: true } });
  const ids = seeded.map((t) => t.id);
  if (ids.length) {
    await prisma.payment.deleteMany({ where: { turnId: { in: ids } } });
    await prisma.notificationLog.deleteMany({ where: { turnId: { in: ids } } });
    await prisma.analyticsEvent.deleteMany({ where: { turnId: { in: ids } } });
    await prisma.turn.deleteMany({ where: { id: { in: ids } } });
  }
  console.log('[cleanup-demo] eliminados', ids.length, 'turnos demo');
  await prisma.$disconnect();
})().catch(async (e) => { console.error(e.message); process.exit(1); });
