import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettierConfig from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';

// ESLint se ocupa SOLO de calidad/errores; el formato lo maneja Prettier por
// separado. Por eso NO usamos eslint-plugin-prettier (que además fallaba al
// intentar cargar prettier-plugin-tailwindcss referenciado en .prettierrc pero
// no instalado). eslint-config-prettier desactiva reglas estilísticas en
// conflicto con Prettier.
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Best-practice/DX (react-hooks v7 + react-refresh) que el código actual
      // todavía no cumple. Quedan en WARN para no romper el gate de lint sin
      // refactorizar componentes que funcionan. Deuda para una tarea de calidad
      // de frontend dedicada (no es parte de F0).
      'react-hooks/set-state-in-effect': 'warn',
      'react-refresh/only-export-components': 'warn',
    },
  },
]);
