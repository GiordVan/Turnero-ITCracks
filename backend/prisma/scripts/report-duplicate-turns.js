// SOLO LECTURA. Reporta las reservas activas duplicadas por slot (fecha, hora,
// profesional) que impedirían crear el índice único parcial. No modifica nada.
//
//   node prisma/scripts/report-duplicate-turns.js   (o: npm run db:duplicates:report)

const prisma = require('../../src/lib/prisma');
const { findDuplicateGroups, planGroup } = require('./_duplicate-turns');

(async () => {
  const groups = await findDuplicateGroups(prisma);

  if (groups.length === 0) {
    console.log('[report-duplicate-turns] OK: no hay reservas activas duplicadas por slot.');
    await prisma.$disconnect();
    return;
  }

  console.log(
    `[report-duplicate-turns] ${groups.length} grupo(s) con reservas ACTIVAS duplicadas:\n`,
  );
  for (const g of groups) {
    const plan = planGroup(g);
    const [date, time, pro] = g.key.split('|');
    console.log(`• ${date} ${time} · profesional ${pro} — ${g.turns.length} turnos activos`);
    for (const t of g.turns) {
      const paid = t.payments.length > 0 ? ' [seña PAGADA]' : '';
      console.log(
        `    - turn ${t.id} (#${t.number}, ${t.status}) ${t.customerName ?? ''} <${t.email ?? ''}> creado ${t.createdAt.toISOString()}${paid}`,
      );
    }
    if (plan.conflict) {
      console.log(`    ⚠ CONFLICTO: ${plan.reason}. Requiere revisión MANUAL.`);
    } else {
      console.log(
        `    → conservaría: ${plan.keeper.id}; cancelaría: ${plan.toCancel.map((t) => t.id).join(', ')}`,
      );
    }
    console.log('');
  }
  console.log(
    'Este script es de SOLO LECTURA. Para reparar de forma auditable: npm run db:duplicates:repair -- --apply',
  );
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('[report-duplicate-turns] ERROR:', e.message);
  try {
    await prisma.$disconnect();
  } catch {
    /* noop */
  }
  process.exit(1);
});
