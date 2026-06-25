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
};

const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

module.exports = config;
