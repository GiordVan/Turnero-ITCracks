// Setup de Vitest: se ejecuta antes de cada archivo de test.
//
// Provee valores de entorno seguros por defecto para que los tests corran sin
// necesidad de exportar variables manualmente (`npm test` funciona out-of-the-box).
// Los tests unitarios inyectan un `db` falso y no tocan la base; estos valores
// son sólo para satisfacer cualquier lectura de config. Un DATABASE_URL real
// (p.ej. la base de testing en CI) tiene prioridad si ya está definido.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-not-real-please-override-in-ci';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/turnero_test?schema=public';
