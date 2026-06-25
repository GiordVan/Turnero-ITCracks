import { describe, it, expect, vi } from 'vitest';
import analyticsService from '../src/services/analytics.service.js';

const { getDashboard } = analyticsService;

// launchDate por defecto = 2026-05-01 (config). Antes < esa fecha, después >=.
function makeDb() {
  const turns = [
    // antes (sin sistema): 2 turnos, 1 no-show
    { status: 'NO_SHOW', scheduledDate: '2026-03-10', professionalId: 'A', confirmedVia: null, email: 'x@a.com' },
    { status: 'COMPLETED', scheduledDate: '2026-03-11', professionalId: 'A', confirmedVia: null, email: 'y@a.com' },
    // después (con sistema): 2 turnos, 0 no-show, confirmados por recordatorio
    { status: 'COMPLETED', scheduledDate: '2026-05-10', professionalId: 'B', confirmedVia: 'REMINDER', email: 'x@a.com' },
    { status: 'COMPLETED', scheduledDate: '2026-05-11', professionalId: 'B', confirmedVia: 'REMINDER', email: 'z@a.com' },
  ];
  return {
    turn: { findMany: vi.fn().mockResolvedValue(turns) },
    payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 5000 }, _count: 2 }) },
    notificationLog: { count: vi.fn().mockResolvedValue(2) },
    professional: { findMany: vi.fn().mockResolvedValue([{ id: 'A', name: 'Carlos' }, { id: 'B', name: 'Nico' }]) },
  };
}

describe('getDashboard', () => {
  it('calcula no-show antes vs después con el corte de lanzamiento', async () => {
    const r = await getDashboard(makeDb());
    expect(r.noShow.antes.total).toBe(2);
    expect(r.noShow.antes.noShow).toBe(1);
    expect(r.noShow.antes.rate).toBe(0.5);
    expect(r.noShow.despues.total).toBe(2);
    expect(r.noShow.despues.noShow).toBe(0);
    expect(r.noShow.despues.rate).toBe(0);
  });

  it('calcula recordatorios confirmados e ingresos por seña', async () => {
    const r = await getDashboard(makeDb());
    expect(r.reminders.sent).toBe(2);
    expect(r.reminders.confirmed).toBe(2);
    expect(r.reminders.responseRate).toBe(1);
    expect(r.revenue.totalAmount).toBe(5000);
    expect(r.revenue.depositsPaid).toBe(2);
  });

  it('cuenta clientes únicos y recurrentes', async () => {
    const r = await getDashboard(makeDb());
    expect(r.conversion.uniqueCustomers).toBe(3); // x, y, z
    expect(r.conversion.repeatCustomers).toBe(1); // x@a.com aparece 2 veces
  });

  it('arma ocupación por profesional', async () => {
    const r = await getDashboard(makeDb());
    const carlos = r.occupancy.find((o) => o.name === 'Carlos');
    expect(carlos.total).toBe(2);
    expect(carlos.completed).toBe(1);
  });

  it('un turno en la fecha exacta de lanzamiento cae en "después"', async () => {
    const db = {
      turn: { findMany: vi.fn().mockResolvedValue([
        { status: 'COMPLETED', scheduledDate: '2026-05-01', professionalId: 'B', confirmedVia: null, email: 'b@a.com' },
      ]) },
      payment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 }, _count: 0 }) },
      notificationLog: { count: vi.fn().mockResolvedValue(0) },
      professional: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const r = await getDashboard(db);
    expect(r.noShow.despues.total).toBe(1);
    expect(r.noShow.antes.total).toBe(0);
  });
});
