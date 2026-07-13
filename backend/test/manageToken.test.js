import { describe, it, expect } from 'vitest';
import manageToken from '../src/lib/manageToken.js';

const { sign, verify, expiryForTurn } = manageToken;

describe('manageToken', () => {
  it('un token firmado se verifica contra su propio turnId', () => {
    const token = sign('turn_123');
    expect(verify(token, 'turn_123')).toBe(true);
  });

  it('no verifica contra un turnId distinto (vínculo inequívoco)', () => {
    const token = sign('turn_123');
    expect(verify(token, 'turn_999')).toBe(false);
  });

  it('rechaza un token vencido', () => {
    const token = sign('turn_123', { expiresAt: Date.now() - 1000 });
    expect(verify(token, 'turn_123')).toBe(false);
  });

  it('rechaza un token manipulado (firma inválida)', () => {
    const token = sign('turn_123');
    const tampered = token.slice(0, -2) + (token.endsWith('aa') ? 'bb' : 'aa');
    expect(verify(tampered, 'turn_123')).toBe(false);
  });

  it('rechaza entradas no-token', () => {
    expect(verify('', 'turn_123')).toBe(false);
    expect(verify('sinpunto', 'turn_123')).toBe(false);
    expect(verify(null, 'turn_123')).toBe(false);
    expect(verify(undefined, 'turn_123')).toBe(false);
  });

  it('expiryForTurn usa la hora del turno + 24h', () => {
    const turn = { scheduledDate: '2026-06-10', scheduledTime: '10:30' };
    const exp = expiryForTurn(turn);
    const base = new Date('2026-06-10T10:30:00').getTime();
    expect(exp).toBe(base + 24 * 3600 * 1000);
  });
});
