import { describe, it, expect, vi } from 'vitest';
import depositService from '../src/services/deposit.service.js';

const { createDeposit, confirmDeposit } = depositService;

function makeDb(overrides = {}) {
  return {
    turn: { findUnique: vi.fn().mockResolvedValue({ id: 'T1' }) },
    payment: {
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ id: 'P1', status: 'PENDING', externalRef: 'P1' }),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'P1', ...data })),
      update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
    },
    ...overrides,
  };
}

describe('createDeposit', () => {
  it('crea un pago PENDING con monto de config', async () => {
    const db = makeDb();
    const payment = await createDeposit('T1', 'x@y.com', db);
    expect(db.payment.create).toHaveBeenCalled();
    expect(payment.status).toBe('PENDING');
    expect(typeof payment.amount).toBe('number');
    expect(payment.amount).toBeGreaterThan(0);
  });

  it('es idempotente: si ya existe pago para el turno, lo devuelve sin crear', async () => {
    const db = makeDb({
      payment: {
        findFirst: vi.fn().mockResolvedValue({ id: 'EXIST', status: 'PENDING' }),
        create: vi.fn(),
      },
    });
    const payment = await createDeposit('T1', 'x@y.com', db);
    expect(payment.id).toBe('EXIST');
    expect(db.payment.create).not.toHaveBeenCalled();
  });

  it('turno inexistente -> 404', async () => {
    const db = makeDb({ turn: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(createDeposit('ZZZ', 'x@y.com', db)).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('confirmDeposit', () => {
  it('marca el pago como PAID con paidAt', async () => {
    const db = makeDb();
    const payment = await confirmDeposit('P1', 'x@y.com', db);
    expect(payment.status).toBe('PAID');
    expect(payment.paidAt).toBeInstanceOf(Date);
    expect(db.payment.update).toHaveBeenCalled();
  });

  it('pago inexistente -> 404', async () => {
    const db = makeDb({ payment: { findUnique: vi.fn().mockResolvedValue(null) } });
    await expect(confirmDeposit('ZZZ', 'x@y.com', db)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('es idempotente: si el pago ya esta PAID, no vuelve a actualizar', async () => {
    const db = makeDb({
      payment: {
        findUnique: vi.fn().mockResolvedValue({ id: 'P1', status: 'PAID' }),
        update: vi.fn(),
      },
    });
    const payment = await confirmDeposit('P1', 'x@y.com', db);
    expect(payment.status).toBe('PAID');
    expect(db.payment.update).not.toHaveBeenCalled();
  });
});
