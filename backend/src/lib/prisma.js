const { PrismaClient } = require('@prisma/client');

// Singleton PrismaClient con inicialización PEREZOSA.
//
// Importar este módulo NO instancia el cliente ni abre conexiones: el
// PrismaClient se crea recién en el primer acceso real (p.ej. `prisma.turn`).
// Esto permite que los tests unitarios, que inyectan un `db` falso, importen los
// services sin requerir un cliente generado ni una base de datos.
//
// Cada `new PrismaClient()` abre su propio pool; por eso cacheamos una única
// instancia en globalThis (también evita que los reloads de nodemon acumulen
// instancias en desarrollo).
const globalForPrisma = globalThis;

function getClient() {
  if (!globalForPrisma.__prisma) {
    globalForPrisma.__prisma = new PrismaClient();
  }
  return globalForPrisma.__prisma;
}

// Proxy que resuelve al cliente real en el primer acceso. Los métodos se bindean
// al cliente para preservar `this` (p.ej. `prisma.$transaction(...)`).
module.exports = new Proxy(
  {},
  {
    get(_target, prop) {
      const client = getClient();
      const value = client[prop];
      return typeof value === 'function' ? value.bind(client) : value;
    },
  },
);
