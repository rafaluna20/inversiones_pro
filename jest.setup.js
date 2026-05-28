/**
 * Jest Setup File
 * Se ejecuta antes de cada test suite
 */

import '@testing-library/jest-dom';

// Mock Firebase
jest.mock('./lib/firebase/config', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      })),
      where: jest.fn(() => ({
        get: jest.fn(),
      })),
      add: jest.fn(),
      get: jest.fn(),
    })),
  },
  storage: {
    ref: jest.fn(() => ({
      put: jest.fn(),
      getDownloadURL: jest.fn(),
    })),
  },
}));

// Mock Redis
jest.mock('./lib/security/rate-limiter', () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    info: jest.fn(),
    dbSize: jest.fn(),
    flushDb: jest.fn(),
    connect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  },
  rateLimiterGeneral: jest.fn((req, res, next) => next()),
  rateLimiterEstricto: jest.fn((req, res, next) => next()),
  rateLimiterAuth: jest.fn((req, res, next) => next()),
}));

// Mock Winston Logger
jest.mock('./lib/performance/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
  financeLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  inversionLogger: {
    info: jest.fn(),
    error: jest.fn(),
  },
  authLogger: {
    info: jest.fn(),
  },
}));

// Mock Next.js Router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
  }),
}));

// Environment variables para testing
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-bytes-long';
process.env.ENCRYPTION_SALT = 'test-salt';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.NODE_ENV = 'test';

// Global test timeout (10 segundos)
jest.setTimeout(10000);

// Limpiar mocks después de cada test
afterEach(() => {
  jest.clearAllMocks();
});
