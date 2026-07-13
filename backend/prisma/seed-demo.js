const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');

const LAUNCH_DATE = '2026-05-01';
const START = '2026-02-02';
const END = '2026-06-23';
const DEPOSIT_AMOUNT = 2500;
const FIRST = ['Juan','Martin','Lucas','Diego','Pablo','Nicolas','Tomas','Mateo','Joaquin','Bruno','Ramiro','Ivan','Facundo','Agustin','Santiago','Emiliano','Franco','Gonzalo','Ezequiel','Maxi','Lautaro','Thiago','Valentin','Benjamin'];
const LAST = ['Perez','Gomez','Diaz','Romero','Sosa','Ruiz','Castro','Silva','Torres','Vega','Luna','Cruz','Rios','Mora','Paz','Vera','Ortiz','Mendez','Ponce','Aguirre'];
const SLOTS = ['10:00','10:30','11:00','11:30','12:00','15:00','15:30','16:00','16:30','17:00','17:30','18:00'];
const POOL_SIZE = 180; // clientes únicos; 763 turnos sobre 180 ⇒ buena tasa de recurrencia

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const fakePhone = () => '+54911' + String(20000000 + rand(79999999));

// Pool fijo de clientes con identidad estable (nombre/email/teléfono), para que
// muchos vuelvan y la analítica muestre clientes recurrentes reales.
function buildCustomers() {
  const seen = new Set();
  const arr = [];
  let i = 0;
  while (arr.length < POOL_SIZE && i < FIRST.length * LAST.length) {
    const first = FIRST[i % FIRST.length];
    const last = LAST[Math.floor(i / FIRST.length) % LAST.length];
    const key = first + last;
    i++;
    if (seen.has(key)) continue;
    seen.add(key);
    arr.push({
      name: `${first} ${last}`,
      email: `${first}.${last}`.toLowerCase() + arr.length + '@demo.com',
      phone: fakePhone(),
    });
  }
  return arr;
}

async function backup() {
  const dir = path.join(__dirname, '..', 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const data = {
    users: await prisma.user.findMany(),
    professionals: await prisma.professional.findMany(),
    workBands: await prisma.workBand.findMany(),
    adminConfig: await prisma.adminConfig.findMany(),
    turns: await prisma.turn.findMany(),
    payments: await prisma.payment.findMany(),
    notificationLogs: await prisma.notificationLog.findMany(),
  };
  const file = path.join(dir, `db-backup-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('[seed-demo] backup escrito en', file);
}

async function cleanup() {
  const seeded = await prisma.turn.findMany({ where: { notes: 'SEED_DEMO' }, select: { id: true } });
  const ids = seeded.map((t) => t.id);
  if (ids.length) {
    await prisma.payment.deleteMany({ where: { turnId: { in: ids } } });
    await prisma.notificationLog.deleteMany({ where: { turnId: { in: ids } } });
    await prisma.analyticsEvent.deleteMany({ where: { turnId: { in: ids } } });
    await prisma.turn.deleteMany({ where: { id: { in: ids } } });
  }
  return ids.length;
}

async function main() {
  await backup();
  const removed = await cleanup();
  console.log('[seed-demo] limpiados', removed, 'turnos demo previos');

  const pros = await prisma.professional.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  if (pros.length < 1) throw new Error('No hay profesionales. Corré el seed base primero.');

  const customers = buildCustomers();

  const start = new Date(START + 'T00:00:00');
  const end = new Date(END + 'T00:00:00');
  let created = 0, payments = 0, reminders = 0;
  const dayCounter = {};

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // domingo cerrado
    const dateStr = d.toLocaleDateString('sv-SE');
    const isAfter = dateStr >= LAUNCH_DATE;
    const turnsToday = 5 + rand(5);
    const used = new Set();

    for (let k = 0; k < turnsToday; k++) {
      const pro = pick(pros);
      const slot = pick(SLOTS);
      const key = pro.id + slot;
      if (used.has(key)) continue;
      used.add(key);
      dayCounter[dateStr] = (dayCounter[dateStr] || 0) + 1;
      const cust = pick(customers);

      const noShowProb = isAfter ? 0.08 : 0.28;
      const roll = Math.random();
      let status = 'COMPLETED';
      if (roll < noShowProb) status = 'NO_SHOW';
      else if (roll < noShowProb + 0.04) status = 'CANCELLED';

      const active = status !== 'CANCELLED';
      const confirmedReminder = isAfter && active && Math.random() < 0.78;

      const turn = await prisma.turn.create({
        data: {
          number: dayCounter[dateStr],
          status,
          customerName: cust.name,
          email: cust.email,
          phone: cust.phone,
          scheduledDate: dateStr,
          scheduledTime: slot,
          professionalId: pro.id,
          notes: 'SEED_DEMO',
          reminderSentAt: isAfter && active ? new Date(dateStr + 'T08:00:00') : null,
          confirmedAt: confirmedReminder ? new Date(dateStr + 'T08:05:00') : null,
          confirmedVia: confirmedReminder ? 'REMINDER' : null,
        },
      });
      created++;

      if (isAfter && active) {
        await prisma.payment.create({
          data: { turnId: turn.id, amount: DEPOSIT_AMOUNT, currency: 'ARS', provider: 'SIMULATED', status: 'PAID', paidAt: new Date(dateStr + 'T07:50:00') },
        });
        payments++;
        await prisma.notificationLog.create({
          data: { turnId: turn.id, channel: 'WHATSAPP', type: 'REMINDER', status: 'SIMULATED', toAddress: turn.phone, body: `Recordatorio: tu turno el ${dateStr} a las ${slot}.` },
        });
        reminders++;
      }
    }
  }

  console.log(`[seed-demo] OK: ${created} turnos, ${payments} señas pagadas, ${reminders} recordatorios`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error('[seed-demo] ERROR:', e.message); await prisma.$disconnect(); process.exit(1); });
