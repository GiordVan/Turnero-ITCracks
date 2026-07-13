const crypto = require('crypto');
const config = require('../config');

// Token de gestión de reserva — versión INTERINA de F0 (stateless, HMAC).
//
// Reemplaza la "autorización por email en el body" (cualquiera que supiera el
// email podía cancelar/pagar un turno ajeno). El token va firmado, vinculado de
// forma inequívoca a un turnId y con expiración; se valida en backend.
//
// Deliberadamente acotado: en F1 se reemplaza por tokens de gestión PERSISTIDOS
// (hasheados, de un solo uso) + OTP. No se persiste ni se registra en logs; se
// entrega en la respuesta de creación del turno y se envía en el body (no en la
// URL) al cancelar/pagar.

const SEP = '.';

function secret() {
  // Secreto dedicado si se define; si no, se deriva del JWT_SECRET (interino).
  return process.env.MANAGE_TOKEN_SECRET || config.jwt.secret || '';
}

function hmac(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

// Expiración basada en la hora del turno + 24h (fallback: 30 días desde ahora).
function expiryForTurn(turn) {
  if (turn?.scheduledDate && turn?.scheduledTime) {
    const t = new Date(`${turn.scheduledDate}T${turn.scheduledTime}:00`);
    if (!Number.isNaN(t.getTime())) return t.getTime() + 24 * 3600 * 1000;
  }
  return Date.now() + 30 * 24 * 3600 * 1000;
}

function sign(turnId, { expiresAt } = {}) {
  const exp = expiresAt ?? Date.now() + 30 * 24 * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ tid: turnId, exp })).toString('base64url');
  return `${payload}${SEP}${hmac(payload)}`;
}

// Verifica firma + expiración + vínculo con el turnId indicado. Nunca lanza.
function verify(token, turnId) {
  if (typeof token !== 'string' || !token.includes(SEP)) return false;
  const [payload, sig] = token.split(SEP);
  if (!payload || !sig) return false;

  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  let data;
  try {
    data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (!data || data.tid !== turnId) return false;
  if (typeof data.exp !== 'number' || Date.now() > data.exp) return false;
  return true;
}

module.exports = { sign, verify, expiryForTurn };
