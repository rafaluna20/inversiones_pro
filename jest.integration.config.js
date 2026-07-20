/**
 * Config separada para tests de INTEGRACIÓN contra el emulador real de
 * Firestore (no mocks). Requiere el emulador corriendo — usar
 * `npm run test:emulator`, que lo levanta y lo apaga automáticamente.
 *
 * Deliberadamente separada de jest.config.js: estos tests no deben correr
 * en un `npm test` normal (no todos los entornos tienen Java/el emulador
 * instalado), y necesitan testEnvironment 'node' en vez de jsdom.
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/integration/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 20000,
  verbose: true,
  // firestore.rules.emulator.test.ts reemplaza el ruleset activo del
  // emulador compartido (@firebase/rules-unit-testing); si otro archivo de
  // test corriera en paralelo contra el mismo emulador asumiendo las reglas
  // permisivas de firestore.test.rules, podría fallar de forma intermitente
  // según el orden de ejecución. Correr todo en serie evita esa interferencia.
  maxWorkers: 1,
};

module.exports = createJestConfig(customJestConfig);
