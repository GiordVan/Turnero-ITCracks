import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import express from 'express';
import app from '../../src/app.js'; // registra el override global morgan.token('url', ...)
import config from '../../src/config/index.js';
import prisma from '../../src/lib/prisma.js';

const adminJwt = jwt.sign({ id: 'admin1', role: 'ADMIN' }, config.jwt.secret, { expiresIn: '1h' });

afterAll(async () => {
  await prisma.$disconnect();
});

describe('SSE con token efímero (el JWT principal no viaja por query)', () => {
  it('POST /api/admin/sse-token sin auth → 401', async () => {
    const res = await request(app).post('/api/admin/sse-token');
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/sse-token con JWT admin → 200 y token efímero purpose=sse', async () => {
    const res = await request(app)
      .post('/api/admin/sse-token')
      .set('Authorization', `Bearer ${adminJwt}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    const decoded = jwt.verify(res.body.token, config.jwt.secret);
    expect(decoded.purpose).toBe('sse');
    expect(decoded.exp - decoded.iat).toBeLessThanOrEqual(120); // ~60s
  });

  it('GET stream sin token → 401', async () => {
    const res = await request(app).get('/api/admin/notifications/stream');
    expect(res.status).toBe(401);
  });

  it('GET stream con el JWT principal (no efímero) → 401', async () => {
    const res = await request(app)
      .get('/api/admin/notifications/stream')
      .query({ token: adminJwt });
    expect(res.status).toBe(401);
  });
});

describe('redacción de logs (morgan)', () => {
  it('el token del query string no aparece en el log de acceso', async () => {
    const lines = [];
    const probe = express();
    // Usa el mismo morgan con el override global registrado por app.js.
    probe.use(morgan('combined', { stream: { write: (s) => lines.push(s) } }));
    probe.get('/x', (req, res) => res.end('ok'));

    await request(probe).get('/x').query({ token: 'SUPERSECRET123' });
    await new Promise((r) => setTimeout(r, 25)); // morgan loguea al 'finish' de la respuesta

    const log = lines.join('');
    expect(log).not.toContain('SUPERSECRET123');
    expect(log).toContain('token=REDACTED');
  });
});
