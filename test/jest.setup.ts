// Jest setup for E2E tests
jest.setTimeout(30000);

// Mock marked module to avoid ESM import issues in tests
jest.mock('marked', () => {
  const mockMarked = jest.fn((markdown: string) => `<p>${markdown}</p>`);
  mockMarked.setOptions = jest.fn();
  mockMarked.getDefaults = jest.fn(() => ({}));
  return {
    marked: mockMarked,
  };
});

// Store original console methods
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;
let originalConsoleWarn: typeof console.warn;

beforeAll(() => {
  // Store original console methods
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  originalConsoleWarn = console.warn;
  
  // Suppress console output during tests to prevent "Cannot log after tests are done"
  if (process.env.NODE_ENV === 'test') {
    console.log = jest.fn();
    console.warn = jest.fn();
    // Keep console.error for debugging but wrap it to prevent post-teardown issues
    const originalError = console.error;
    console.error = (...args) => {
      try {
        originalError(...args);
      } catch {
        // Silently fail if console is no longer available
      }
    };
  }
});

// Global teardown
afterAll(async () => {
  // Allow time for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Restore console methods
  if (typeof originalConsoleLog === 'function') {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
});