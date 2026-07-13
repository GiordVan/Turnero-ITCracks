import { defineConfig } from 'vitest/config';

// Configuración de tests UNITARIOS: rápidos, sin base de datos (usan `db` falso).
// Los tests de integración viven en test/integration/ y se corren con
// vitest.integration.config.mjs (npm run test:integration), ya que necesitan
// una PostgreSQL real.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.js'],
    exclude: ['**/node_modules/**', 'test/integration/**'],
  },
});
