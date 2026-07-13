import { describe, it, expect } from 'vitest';
import { redactSensitiveQuery } from '../src/lib/logRedact.js';

describe('redactSensitiveQuery', () => {
  it('redacta el valor de token', () => {
    const out = redactSensitiveQuery('/api/admin/notifications/stream?token=eyJabc.def');
    expect(out).toBe('/api/admin/notifications/stream?token=REDACTED');
    expect(out).not.toContain('eyJabc');
  });

  it('redacta varios params sensibles y conserva los no sensibles', () => {
    const out = redactSensitiveQuery('/x?token=abc&date=2026-06-10&api_key=zzz');
    expect(out).toContain('date=2026-06-10');
    expect(out).toContain('token=REDACTED');
    expect(out).toContain('api_key=REDACTED');
    expect(out).not.toContain('abc');
    expect(out).not.toContain('zzz');
  });

  it('es case-insensitive en la clave', () => {
    expect(redactSensitiveQuery('/x?Token=secreto')).toBe('/x?Token=REDACTED');
  });

  it('deja intactas las URLs sin query o sin params sensibles', () => {
    expect(redactSensitiveQuery('/api/health')).toBe('/api/health');
    expect(redactSensitiveQuery('/x?date=2026-06-10')).toBe('/x?date=2026-06-10');
  });
});
