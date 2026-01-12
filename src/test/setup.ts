import { expect, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import '@testing-library/jest-dom/vitest';

expect.extend(matchers);

let consoleErrorCalls: unknown[][] = [];
const originalConsoleError = console.error;

console.error = (...args: unknown[]) => {
  consoleErrorCalls.push(args);
  originalConsoleError(...args);
};

beforeEach(() => {
  consoleErrorCalls = [];
});

afterEach(() => {
  cleanup();

  if (consoleErrorCalls.length > 0) {
    const formatted = consoleErrorCalls
      .map((call) => call.map((v) => {
        try {
          return typeof v === 'string' ? v : JSON.stringify(v);
        } catch {
          return String(v);
        }
      }).join(' '))
      .join('\n');

    throw new Error(`Unexpected console.error in test:\n${formatted}`);
  }
});
