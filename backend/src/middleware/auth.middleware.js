const jwt = require('jsonwebtoken');
const config = require('../config');

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
};

// Firma un token EFÍMERO y DEDICADO para abrir el stream SSE. Corta duración y
// purpose='sse'. Así el JWT principal (7 días) nunca viaja por query string.
const signSseToken = (user) =>
  jwt.sign({ id: user.id, role: user.role, purpose: 'sse' }, config.jwt.secret, {
    expiresIn: config.sse.tokenTtl,
  });

// Auth del stream SSE por query param (EventSource no manda headers). Exige que
// el token sea el EFÍMERO (purpose='sse'): el JWT principal se rechaza acá.
const authenticateSse = (req, res, next) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    if (payload.purpose !== 'sse') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authenticate, authenticateSse, signSseToken, authorize };
