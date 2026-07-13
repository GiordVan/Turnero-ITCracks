const js = require('@eslint/js');
const prettier = require('eslint-config-prettier');
const globals = require('globals');

// Flat config (ESLint 9+/10). Reemplaza al viejo .eslintrc.cjs, que ESLint 10
// ya no soporta.
//
// ESLint se ocupa SOLO de calidad/errores. El formato lo maneja Prettier por
// separado (`npm run format` / `npm run format:check`), por eso NO usamos
// eslint-plugin-prettier (que reportaría diferencias de formato como errores).
// eslint-config-prettier desactiva las reglas estilísticas de ESLint que
// entrarían en conflicto con Prettier.
module.exports = [
  js.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      // `_`/`_nombre` marca descartes intencionales (args y también variables,
      // p.ej. `const { password: _, ...rest } = user`).
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
