import { describe, it, expect, afterEach } from 'vitest';
import config from '../src/config/index.js';

const { validateConfig } = config;

// Guarda/restaura las env que tocan estos tests.
const ORIG = {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
};

afterEach(() => {
  for (const [k, v] of Object.entries(ORIG)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe('validateConfig', () => {
  it('falla si falta DATABASE_URL', () => {
    delete process.env.DATABASE_URL;
    expect(() => validateConfig()).toThrow(/DATABASE_URL/);
  });

  it('en producción exige JWT_SECRET de al menos 32 caracteres', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/db';
    process.env.JWT_SECRET = 'corto';
    process.env.CORS_ORIGIN = 'https://ejemplo.com';
    expect(() => validateConfig()).toThrow(/JWT_SECRET/);
  });

  it('en producción exige CORS_ORIGIN', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/db';
    process.env.JWT_SECRET = 'a'.repeat(32);
    delete process.env.CORS_ORIGIN;
    expect(() => validateConfig()).toThrow(/CORS_ORIGIN/);
  });

  it('en producción pasa con JWT_SECRET fuerte y CORS_ORIGIN definido', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/db';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.CORS_ORIGIN = 'https://ejemplo.com';
    expect(() => validateConfig()).not.toThrow();
  });

  it('en desarrollo no exige fortaleza extra (sólo las vars requeridas)', () => {
    process.env.NODE_ENV = 'development';
    process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/db';
    process.env.JWT_SECRET = 'corto';
    delete process.env.CORS_ORIGIN;
    expect(() => validateConfig()).not.toThrow();
  });
});
