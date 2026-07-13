const rateLimit = require('express-rate-limit');
const config = require('../config');

// Limita intentos de login (fuerza bruta de credenciales). Estricto.
const loginLimiter = rateLimit({
  windowMs: config.rateLimit.login.windowMs,
  limit: config.rateLimit.login.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

// Limita los endpoints públicos (abuso/enumeración/spam de reservas). Moderado.
const publicLimiter = rateLimit({
  windowMs: config.rateLimit.public.windowMs,
  limit: config.rateLimit.public.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.' },
});

module.exports = { loginLimiter, publicLimiter };
