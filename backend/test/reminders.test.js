import { describe, it, expect, vi } from 'vitest';
import reminders from '../src/services/reminders.js';

const { isDue, selectDueTurns, runReminders } = reminders;

const base = {
  id: 't1',
  email: 'a@b.com',
  status: 'WAITING',
  scheduledDate: '2026-06-10',
  scheduledTime: '10:30',
  reminderSentAt: null,
};
// "now" el mismo día a las 00:00 → el turno de las 10:30 cae dentro de 24h
const now = new Date('2026-06-10T00:00:00');

describe('isDue', () => {
  it('marca como due un turno activo, con email, dentro de la ventana', () => {
    expect(isDue(base, now, 24)).toBe(true);
  });

  it('NO recuerda si ya tiene reminderSentAt (idempotencia)', () => {
    expect(isDue({ ...base, reminderSentAt: new Date() }, now, 24)).toBe(false);
  });

  it('NO recuerda si no hay email', () => {
    expect(isDue({ ...base, email: null }, now, 24)).toBe(false);
  });

  it('NO recuerda turnos fuera de la ventana', () => {
    expect(isDue({ ...base, scheduledDate: '2026-06-20' }, now, 24)).toBe(false);
  });

  it('NO recuerda turnos en estado no activo', () => {
    expect(isDue({ ...base, status: 'COMPLETED' }, now, 24)).toBe(false);
  });
});

describe('selectDueTurns', () => {
  it('filtra solo los turnos que corresponde recordar', () => {
    const turns = [
      base,
      { ...base, id: 't2', reminderSentAt: new Date() },
      { ...base, id: 't3', email: null },
    ];
    const due = selectDueTurns(turns, now, 24);
    expect(due.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('runReminders', () => {
  it('envía y setea reminderSentAt cuando el envío es exitoso', async () => {
    const db = {
      turn: {
        findMany: vi.fn().mockResolvedValue([base]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const sendEmail = vi.fn().mockResolvedValue();

    const sent = await runReminders({ now, windowHours: 24, sendEmail, db });

    expect(sent).toBe(1);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(db.turn.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { reminderSentAt: expect.any(Date) },
    });
  });

  it('NO setea reminderSentAt si el envío falla (se reintenta el próximo ciclo)', async () => {
    const db = {
      turn: {
        findMany: vi.fn().mockResolvedValue([base]),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const sendEmail = vi.fn().mockRejectedValue(new Error('resend caído'));

    const sent = await runReminders({ now, windowHours: 24, sendEmail, db });

    expect(sent).toBe(0);
    expect(db.turn.update).not.toHaveBeenCalled();
  });
});
