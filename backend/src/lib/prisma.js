const { PrismaClient } = require('@prisma/client');

// Singleton PrismaClient.
//
// Cada `new PrismaClient()` abre su propio pool de conexiones. Si cada service
// instancia el suyo, terminás con varios pools compitiendo por la misma base.
// Acá creamos uno solo y lo compartimos. En desarrollo lo cacheamos en
// globalThis para que los reloads de nodemon no acumulen instancias.
const globalForPrisma = globalThis;

const prisma = globalForPrisma.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

module.exports = prisma;
