import { describe, it, expect, vi } from 'vitest';
import publicService from '../src/services/public.service.js';
import manageToken from '../src/lib/manageToken.js';

const { getAvailableSlots, createTurn, cancelTurn } = publicService;

// db falso: controla lo que devuelve Prisma sin necesitar una base real.
// $transaction ejecuta el callback con el mismo db falso como "tx".
function makeDb(overrides = {}) {
  const db = {
    adminConfig: { findUnique: vi.fn().mockResolvedValue({ turnDuration: 30 }) },
    workBand: {
      findMany: vi.fn().mockResolvedValue([{ startTime: '10:00', endTime: '11:00' }]),
    },
    professional: { findUnique: vi.fn().mockResolvedValue({ id: 'A', isActive: true }) },
    turn: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
    },
    ...overrides,
  };
  db.$transaction = async (fn) => fn(db);
  return db;
}

describe('getAvailableSlots (disponibilidad por profesional)', () => {
  it('consulta los reservados filtrando por professionalId', async () => {
    const db = makeDb();
    await getAvailableSlots('2026-06-10', 'A', db);
    expect(db.turn.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scheduledDate: '2026-06-10', professionalId: 'A' }),
      }),
    );
  });

  it('resta solo los slots ocupados de ese profesional', async () => {
    // banda 10:00-11:00, duración 30 → slots 10:00 y 10:30; 10:00 ocupado → queda 10:30
    const db = makeDb({
      turn: { findMany: vi.fn().mockResolvedValue([{ scheduledTime: '10:00' }]) },
    });
    const slots = await getAvailableSlots('2026-06-10', 'A', db);
    expect(slots).toEqual(['10:30']);
  });
});

describe('createTurn (agendas independientes por peluquero)', () => {
  it('CRÍTICO: mismo horario con OTRO peluquero no choca (no 409)', async () => {
    const db = makeDb({
      professional: { findUnique: vi.fn().mockResolvedValue({ id: 'B', isActive: true }) },
      turn: {
        findFirst: vi.fn().mockResolvedValue(null), // no hay conflicto para B
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new', ...data })),
      },
    });

    const turn = await createTurn(
      { customerName: 'X', email: 'x@y.com', scheduledDate: '2026-06-10', scheduledTime: '10:30', professionalId: 'B' },
      db,
    );

    expect(turn.professionalId).toBe('B');
    // el chequeo de conflicto se hizo filtrando por professionalId
    expect(db.turn.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ professionalId: 'B', scheduledTime: '10:30' }),
      }),
    );
  });

  it('mismo peluquero y horario ya reservado → 409', async () => {
    const db = makeDb({
      turn: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existente' }),
        create: vi.fn(),
      },
    });

    await expect(
      createTurn(
        { customerName: 'X', email: 'x@y.com', scheduledDate: '2026-06-10', scheduledTime: '10:30', professionalId: 'A' },
        db,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('carrera: el chequeo aplicativo no ve conflicto pero la DB rechaza (P2002) → 409', async () => {
    // Simula dos requests concurrentes: findFirst no ve conflicto, pero el índice
    // único parcial hace fallar el INSERT del segundo con P2002. Debe dar 409, no 500.
    const db = makeDb({
      turn: {
        findFirst: vi.fn().mockResolvedValue(null), // sin conflicto aplicativo
        create: vi.fn().mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' })),
      },
    });

    await expect(
      createTurn(
        { customerName: 'X', email: 'x@y.com', scheduledDate: '2026-06-10', scheduledTime: '10:30', professionalId: 'A' },
        db,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('peluquero inexistente o inactivo → 422', async () => {
    const db = makeDb({ professional: { findUnique: vi.fn().mockResolvedValue(null) } });

    await expect(
      createTurn(
        { customerName: 'X', email: 'x@y.com', scheduledDate: '2026-06-10', scheduledTime: '10:30', professionalId: 'ZZZ' },
        db,
      ),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});

describe('cancelTurn (autorización por token de gestión)', () => {
  function cancelDb(turn) {
    return {
      turn: {
        findUnique: vi.fn().mockResolvedValue(turn),
        update: vi.fn().mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data })),
      },
    };
  }

  it('con token válido y estado cancelable → cancela', async () => {
    const db = cancelDb({ id: 'T1', status: 'WAITING' });
    const token = manageToken.sign('T1');
    const res = await cancelTurn('T1', token, db);
    expect(res.status).toBe('CANCELLED');
    expect(db.turn.update).toHaveBeenCalled();
  });

  it('con token inválido → 403 (no alcanza conocer el id)', async () => {
    const db = cancelDb({ id: 'T1', status: 'WAITING' });
    await expect(cancelTurn('T1', manageToken.sign('OTRO'), db)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.turn.update).not.toHaveBeenCalled();
  });

  it('turno inexistente → 404', async () => {
    const db = cancelDb(null);
    await expect(cancelTurn('T1', manageToken.sign('T1'), db)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('estado no cancelable → 409', async () => {
    const db = cancelDb({ id: 'T1', status: 'COMPLETED' });
    await expect(cancelTurn('T1', manageToken.sign('T1'), db)).rejects.toMatchObject({ statusCode: 409 });
  });
});
