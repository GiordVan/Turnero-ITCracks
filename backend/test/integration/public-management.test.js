import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/lib/prisma.js';

// Flujo público de gestión (F0): reservar devuelve un token; cancelar exige ese
// token (no alcanza el email/id); my-turns por email queda deshabilitado (410).
let professionalId;

async function book(time) {
  return request(app).post('/api/public/turns').send({
    customerName: 'Cliente',
    email: 'c@test.com',
    phone: '+5491100000000',
    scheduledDate: '2099-02-01',
    scheduledTime: time,
    professionalId,
  });
}

describe('gestión pública de reservas (token)', () => {
  beforeAll(async () => {
    const p = await prisma.professional.create({
      data: { name: 'TEST Manage', isActive: true },
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

  it('crear turno devuelve un manageToken', async () => {
    const res = await book('10:00');
    expect(res.status).toBe(201);
    expect(typeof res.body.manageToken).toBe('string');
    expect(res.body.manageToken.length).toBeGreaterThan(10);
  });

  it('cancelar sin token → 422; con token ajeno → 403; con el token correcto → 200', async () => {
    const created = await book('11:00');
    const { id, manageToken } = created.body;

    const noToken = await request(app).patch(`/api/public/turns/${id}/cancel`).send({});
    expect(noToken.status).toBe(422);

    const wrong = await request(app)
      .patch(`/api/public/turns/${id}/cancel`)
      .send({ token: 'payload.firmafalsa' });
    expect(wrong.status).toBe(403);

    const ok = await request(app)
      .patch(`/api/public/turns/${id}/cancel`)
      .send({ token: manageToken });
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('CANCELLED');
  });

  it('GET /api/public/my-turns por email → 410 (deshabilitado en F0)', async () => {
    const res = await request(app).get('/api/public/my-turns').query({ email: 'c@test.com' });
    expect(res.status).toBe(410);
  });
});
