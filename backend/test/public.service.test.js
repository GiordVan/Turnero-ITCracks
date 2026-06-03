import { describe, it, expect, vi } from 'vitest';
import publicService from '../src/services/public.service.js';

const { getAvailableSlots, createTurn } = publicService;

// db falso: controla lo que devuelve Prisma sin necesitar una base real.
function makeDb(overrides = {}) {
  return {
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
