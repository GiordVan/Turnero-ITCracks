import { describe, it, expect, vi } from 'vitest';
import notifier from '../src/lib/notifications/index.js';

const { sendNotification } = notifier;

function makeDb() {
  return {
    notificationLog: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'N1', ...data })),
    },
  };
}

const turn = {
  id: 'T1', customerName: 'Juan', phone: '+5491111111111',
  scheduledDate: '2026-06-10', scheduledTime: '10:30',
  professional: { name: 'Carlos' },
};

describe('sendNotification', () => {
  it('compone y registra en NotificationLog (simulado)', async () => {
    const db = makeDb();
    const sender = { name: 'WHATSAPP', send: vi.fn().mockResolvedValue({ status: 'SIMULATED' }) };
    const log = await sendNotification({ turn, type: 'CONFIRMATION', db, sender });
    expect(sender.send).toHaveBeenCalled();
    expect(db.notificationLog.create).toHaveBeenCalled();
    expect(log.channel).toBe('WHATSAPP');
    expect(log.type).toBe('CONFIRMATION');
    expect(log.status).toBe('SIMULATED');
    expect(log.body).toContain('Carlos');
  });

  it('registra FAILED y relanza si el canal falla', async () => {
    const db = makeDb();
    const sender = { name: 'WHATSAPP', send: vi.fn().mockRejectedValue(new Error('caido')) };
    await expect(sendNotification({ turn, type: 'REMINDER', db, sender })).rejects.toThrow('caido');
    expect(db.notificationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('tipo desconocido lanza', async () => {
    const sender = { name: 'WHATSAPP', send: vi.fn() };
    await expect(sendNotification({ turn, type: 'XXX', db: makeDb(), sender })).rejects.toThrow();
  });
});
