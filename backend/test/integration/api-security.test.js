import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/lib/prisma.js';

// Tests de API (supertest) contra el app real + PostgreSQL real.
afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/health', () => {
  it('devuelve 200 y db:up cuando la base responde', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });
});

describe('rate limiting de /api/auth/login', () => {
  it('bloquea con 429 al superar el límite de intentos', async () => {
    // Límite por defecto = 5 por ventana. Disparamos 6 intentos fallidos.
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: '123456' });
      statuses.push(res.status);
    }
    // Los primeros no deben ser 429; el último sí.
    expect(statuses[0]).not.toBe(429);
    expect(statuses[statuses.length - 1]).toBe(429);
    expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1);
  });
});
