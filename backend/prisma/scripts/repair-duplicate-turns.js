// Reparación AUDITABLE de reservas activas duplicadas por slot.
//
// - DRY-RUN por defecto: sólo informa qué haría, sin tocar nada.
// - Con --apply: marca como CANCELLED (soft, reversible) los turnos duplicados
//   sobrantes, conservando uno por grupo (ver planGroup), agregando una nota
//   auditable "DUP_REPAIR <ISO>". Los cambios van dentro de una transacción.
// - IDEMPOTENTE: al re-ejecutar, los ya cancelados no vuelven a aparecer.
// - Nunca cancela automáticamente un grupo con más de una seña PAGADA: lo marca
//   como conflicto para revisión manual.
//
//   node prisma/scripts/repair-duplicate-turns.js            (dry-run)
//   node prisma/scripts/repair-duplicate-turns.js --apply    (aplica)
//   npm run db:duplicates:repair -- --apply

const prisma = require('../../src/lib/prisma');
const { findDuplicateGroups, planGroup } = require('./_duplicate-turns');

const APPLY = process.argv.includes('--apply');

(async () => {
  const groups = await findDuplicateGroups(prisma);
  if (groups.length === 0) {
    console.log('[repair-duplicate-turns] OK: no hay reservas activas duplicadas. Nada para hacer.');
    await prisma.$disconnect();
    return;
  }

  const plans = groups.map(planGroup);
  const conflicts = plans.filter((p) => p.conflict);
  const actionable = plans.filter((p) => !p.conflict);
  const toCancel = actionable.flatMap((p) => p.toCancel);

  console.log(
    `[repair-duplicate-turns] ${groups.length} grupo(s) duplicado(s): ${conflicts.length} en conflicto (revisión manual), ${toCancel.length} turno(s) a cancelar.\n`,
  );
  for (const p of actionable) {
    const [date, time, pro] = p.key.split('|');
    console.log(
      `• ${date} ${time} · prof ${pro}: conservar ${p.keeper.id}; cancelar ${p.toCancel.map((t) => t.id).join(', ')}`,
    );
  }
  for (const p of conflicts) {
    const [date, time, pro] = p.key.split('|');
    console.log(`⚠ ${date} ${time} · prof ${pro}: ${p.reason} → NO se toca (revisión manual).`);
  }

  if (!APPLY) {
    console.log('\nMODO DRY-RUN: no se modificó nada. Volvé a correr con --apply para aplicar.');
    await prisma.$disconnect();
    return;
  }

  const note = `DUP_REPAIR ${new Date().toISOString()}`;
  let cancelled = 0;
  await prisma.$transaction(async (tx) => {
    for (const p of actionable) {
      for (const t of p.toCancel) {
        const newNotes = t.notes ? `${t.notes} | ${note}` : note;
        await tx.turn.update({
          where: { id: t.id },
          data: { status: 'CANCELLED', notes: newNotes },
        });
        cancelled += 1;
      }
    }
  });

  console.log(`\n[repair-duplicate-turns] APLICADO: ${cancelled} turno(s) marcados CANCELLED (nota "${note}").`);
  if (conflicts.length) {
    console.log(`${conflicts.length} grupo(s) en conflicto NO fueron modificados (revisión manual).`);
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error('[repair-duplicate-turns] ERROR:', e.message);
  try {
    await prisma.$disconnect();
  } catch {
    /* noop */
  }
  process.exit(1);
});
