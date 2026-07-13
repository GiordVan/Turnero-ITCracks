require('dotenv').config();

const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  // Nº de proxies de confianza (Railway pone 1). Necesario para que
  // express-rate-limit lea la IP real desde X-Forwarded-For sin ser spoofeable.
  trustProxy: process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : 1,
  rateLimit: {
    login: {
      windowMs: Number(process.env.RATE_LIMIT_LOGIN_WINDOW_MS || 15 * 60 * 1000),
      max: Number(process.env.RATE_LIMIT_LOGIN_MAX || 5),
    },
    public: {
      windowMs: Number(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS || 60 * 1000),
      max: Number(process.env.RATE_LIMIT_PUBLIC_MAX || 30),
    },
  },
  payments: {
    provider: (process.env.PAYMENT_PROVIDER || 'simulated').toLowerCase(),
    depositAmount: Number(process.env.DEPOSIT_AMOUNT || 2500),
    currency: process.env.DEPOSIT_CURRENCY || 'ARS',
  },
  whatsapp: {
    mode: (process.env.WHATSAPP_MODE || 'simulated').toLowerCase(),
    apiUrl: process.env.EVOLUTION_API_URL || '',
    apiKey: process.env.EVOLUTION_API_KEY || '',
    instance: process.env.EVOLUTION_INSTANCE || '',
  },
  analytics: {
    launchDate: process.env.ANALYTICS_LAUNCH_DATE || '2026-05-01',
  },
  features: {
    // Consulta pública de turnos por email. Deshabilitada por defecto en F0
    // (exponía datos sin verificación). Se re-habilita con OTP en F1.
    publicMyTurns: process.env.PUBLIC_MY_TURNS_ENABLED === 'true',
  },
  sse: {
    // TTL del token efímero de SSE (dedicado, single-purpose). Corto: sólo se usa
    // para abrir el stream; el JWT principal nunca viaja por query string.
    tokenTtl: process.env.SSE_TOKEN_TTL || '60s',
  },
};

// Validación de entorno. Se ejecuta EXPLÍCITAMENTE al arrancar el servidor
// (ver src/app.js, bajo require.main), no al importar el módulo. Así los tests
// pueden importar services/config sin necesitar variables de entorno reales.
function validateConfig() {
  const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  // Endurecimiento adicional en producción. Lee NODE_ENV en vivo (testeable).
  if ((process.env.NODE_ENV || 'development') === 'production') {
    if ((process.env.JWT_SECRET || '').length < 32) {
      throw new Error('JWT_SECRET débil: en producción debe tener al menos 32 caracteres.');
    }
    if (!process.env.CORS_ORIGIN) {
      throw new Error(
        'CORS_ORIGIN es obligatorio en producción (definí el origen permitido del frontend).',
      );
    }
  }
}

module.exports = config;
module.exports.validateConfig = validateConfig;
