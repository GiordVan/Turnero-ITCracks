module.exports = {
  env: { node: true, es2022: true },
  extends: ['eslint:recommended', 'plugin:prettier/recommended'],
  parserOptions: { ecmaVersion: 'latest' },
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
};
