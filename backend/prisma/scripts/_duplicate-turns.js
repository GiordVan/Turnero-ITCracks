// Helper compartido por los scripts de reporte y reparación de reservas
// duplicadas. Detecta grupos de turnos ACTIVOS (status <> CANCELLED) que
// comparten el mismo slot (scheduledDate, scheduledTime, professionalId), que es
// exactamente lo que impide el índice único parcial "Turn_active_slot_unique".

async function findDuplicateGroups(prisma) {
  const active = await prisma.turn.findMany({
    where: {
      status: { not: 'CANCELLED' },
      scheduledDate: { not: null },
      scheduledTime: { not: null },
      professionalId: { not: null },
    },
    select: {
      id: true,
      number: true,
      status: true,
      customerName: true,
      email: true,
      scheduledDate: true,
      scheduledTime: true,
      professionalId: true,
      notes: true,
      createdAt: true,
      payments: { where: { status: 'PAID' }, select: { id: true, amount: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const byKey = new Map();
  for (const t of active) {
    const key = `${t.scheduledDate}|${t.scheduledTime}|${t.professionalId}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(t);
  }

  const groups = [];
  for (const [key, turns] of byKey) {
    if (turns.length > 1) groups.push({ key, turns });
  }
  return groups;
}

// Decide, para un grupo duplicado, qué turno conservar y cuáles cancelar.
// - Si hay MÁS DE UNO con seña PAGADA -> conflicto: requiere revisión manual
//   (nunca se cancela automáticamente un turno con dinero real).
// - Si hay exactamente uno con seña pagada -> se conserva ese.
// - Si ninguno tiene seña -> se conserva el más antiguo (createdAt; desempate id).
function planGroup(group) {
  const paid = group.turns.filter((t) => t.payments.length > 0);
  if (paid.length > 1) {
    return {
      key: group.key,
      conflict: true,
      reason: 'múltiples turnos con seña PAGADA en el mismo slot',
      turns: group.turns,
    };
  }
  const keeper =
    paid.length === 1
      ? paid[0]
      : group.turns
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0];
  const toCancel = group.turns.filter((t) => t.id !== keeper.id);
  return { key: group.key, conflict: false, keeper, toCancel };
}

module.exports = { findDuplicateGroups, planGroup };
