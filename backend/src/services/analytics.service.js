const prisma = require('../lib/prisma');
const config = require('../config');

const round = (n) => Math.round(n * 100) / 100;
const rate = (part, total) => (total > 0 ? round(part / total) : 0);

// Dashboard de conversión: compara el período "antes" del sistema vs "después"
// (corte = config.analytics.launchDate). Todo se deriva de Turn/Payment/NotificationLog.
const getDashboard = async (db = prisma) => {
  const launchDate = config.analytics.launchDate;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(launchDate)) {
    throw new Error('ANALYTICS_LAUNCH_DATE debe tener formato YYYY-MM-DD');
  }

  const turns = await db.turn.findMany({
    select: {
      status: true,
      scheduledDate: true,
      professionalId: true,
      confirmedVia: true,
      email: true,
    },
  });
  const paid = await db.payment.aggregate({
    where: { status: 'PAID' },
    _sum: { amount: true },
    _count: true,
  });
  const remindersSent = await db.notificationLog.count({ where: { type: 'REMINDER' } });
  const professionals = await db.professional.findMany({ select: { id: true, name: true } });

  const isAfter = (t) => (t.scheduledDate || '') >= launchDate;
  const antes = turns.filter((t) => !isAfter(t));
  const despues = turns.filter(isAfter);
  const noShowCount = (arr) => arr.filter((t) => t.status === 'NO_SHOW').length;

  const confirmed = despues.filter((t) => t.confirmedVia === 'REMINDER').length;
  const completed = turns.filter((t) => t.status === 'COMPLETED').length;

  const emailCounts = {};
  for (const t of turns) {
    if (t.email) emailCounts[t.email] = (emailCounts[t.email] || 0) + 1;
  }
  const uniqueCustomers = Object.keys(emailCounts).length;
  const repeatCustomers = Object.values(emailCounts).filter((c) => c > 1).length;

  const occupancy = professionals.map((p) => {
    const list = turns.filter((t) => t.professionalId === p.id);
    return {
      professionalId: p.id,
      name: p.name,
      total: list.length,
      completed: list.filter((t) => t.status === 'COMPLETED').length,
    };
  });

  const months = {};
  for (const t of turns) {
    const m = (t.scheduledDate || '').slice(0, 7);
    if (!m) continue;
    if (!months[m]) months[m] = { month: m, bookings: 0, noShow: 0 };
    months[m].bookings += 1;
    if (t.status === 'NO_SHOW') months[m].noShow += 1;
  }
  const launchMonth = launchDate.slice(0, 7);
  const timeseries = Object.values(months)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((x) => ({ ...x, period: x.month >= launchMonth ? 'despues' : 'antes' }));

  return {
    launchDate,
    noShow: {
      antes: { total: antes.length, noShow: noShowCount(antes), rate: rate(noShowCount(antes), antes.length) },
      despues: { total: despues.length, noShow: noShowCount(despues), rate: rate(noShowCount(despues), despues.length) },
    },
    reminders: { sent: remindersSent, confirmed, responseRate: rate(confirmed, Math.max(remindersSent, confirmed)) },
    revenue: { depositsPaid: paid._count, totalAmount: paid._sum.amount || 0, currency: config.payments.currency },
    conversion: {
      totalBookings: turns.length,
      completed,
      completionRate: rate(completed, turns.length),
      uniqueCustomers,
      repeatCustomers,
      repeatRate: rate(repeatCustomers, uniqueCustomers),
    },
    occupancy,
    timeseries,
  };
};

module.exports = { getDashboard };
