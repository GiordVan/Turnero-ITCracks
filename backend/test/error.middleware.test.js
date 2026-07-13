import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from '../src/middleware/error.middleware.js';

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler', () => {
  it('errores 4xx intencionales: preserva el mensaje seguro', () => {
    const res = makeRes();
    const err = Object.assign(new Error('Ese horario ya fue reservado'), { statusCode: 409 });
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Ese horario ya fue reservado' }),
    );
  });

  it('errores 5xx: NO filtra el mensaje interno (Prisma/stack)', () => {
    const res = makeRes();
    const err = new Error('Prisma: connection refused at 10.0.0.1:5432 secret=abc');
    errorHandler(err, {}, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    const payload = res.json.mock.calls[0][0];
    expect(payload.message).toBe('Internal Server Error');
    expect(payload.message).not.toContain('secret');
    // En test (NODE_ENV!=development) tampoco se expone el stack.
    expect(payload.stack).toBeUndefined();
  });
});
