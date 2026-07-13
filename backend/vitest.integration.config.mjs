import { defineConfig } from 'vitest/config';

// Configuración de tests de INTEGRACIÓN: corren contra una PostgreSQL real
// (DATABASE_URL debe apuntar a una base de testing, p.ej. la de docker-compose
// o el service de CI). Se ejecutan en serie para evitar interferencia entre
// tests que comparten la base.
//
// `passWithNoTests` evita que el comando falle mientras todavía no hay tests de
// integración (se agregan a partir de F0.2).
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    include: ['test/integration/**/*.test.js'],
    fileParallelism: false,
    passWithNoTests: true,
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
