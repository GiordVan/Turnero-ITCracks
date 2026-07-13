import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import prisma from '../../src/lib/prisma.js';
import publicService from '../../src/services/public.service.js';

// Test de INTEGRACIÓN contra PostgreSQL real (requiere DATABASE_URL a una base de
// testing con las migraciones aplicadas). Verifica que la garantía definitiva
// contra la doble reserva es la base de datos (índice único parcial), no el
// chequeo aplicativo.
const { createTurn } = publicService;

const DATE = '2099-01-01';
let professionalId;

describe('Doble reserva — garantía de concurrencia (Postgres real)', () => {
  beforeAll(async () => {
    const p = await prisma.professional.create({
      data: { name: 'TEST Concurrency', isActive: true },
    });
    professionalId = p.id;
  });

  afterAll(async () => {
    if (professionalId) {
      await prisma.turn.deleteMany({ where: { professionalId } });
      await prisma.professional.delete({ where: { id: professionalId } });
    }
    await prisma.$disconnect();
  });

  it('20 requests concurrentes al mismo slot → exactamente 1 reserva, el resto 409', async () => {
    const N = 20;
    const time = '10:00';
    const attempts = Array.from({ length: N }, () =>
      createTurn({
        customerName: 'Cliente',
        email: 'c@test.com',
        phone: '+5491100000000',
        scheduledDate: DATE,
        scheduledTime: time,
        professionalId,
      }),
    );

    const results = await Promise.allSettled(attempts);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(N - 1);
    for (const r of rejected) {
      expect(r.reason).toMatchObject({ statusCode: 409 });
    }

    const active = await prisma.turn.count({
      where: {
        scheduledDate: DATE,
        scheduledTime: time,
        professionalId,
        status: { not: 'CANCELLED' },
      },
    });
    expect(active).toBe(1);
  });

  it('un turno CANCELLED no bloquea el mismo slot (índice parcial)', async () => {
    const time = '11:00';
    const first = await createTurn({
      customerName: 'Cliente',
      email: 'c@test.com',
      scheduledDate: DATE,
      scheduledTime: time,
      professionalId,
    });
    await prisma.turn.update({ where: { id: first.id }, data: { status: 'CANCELLED' } });

    // El mismo slot debe poder reservarse de nuevo tras la cancelación.
    const second = await createTurn({
      customerName: 'Otro',
      email: 'o@test.com',
      scheduledDate: DATE,
      scheduledTime: time,
      professionalId,
    });
    expect(second.id).not.toBe(first.id);

    const active = await prisma.turn.count({
      where: {
        scheduledDate: DATE,
        scheduledTime: time,
        professionalId,
        status: { not: 'CANCELLED' },
      },
    });
    expect(active).toBe(1);
  });
});
