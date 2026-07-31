import { describe, it, expect } from '@jest/globals';

describe('Homiehouse - Smoke Tests', () => {
  it('should have a working test environment', () => {
    expect(true).toBe(true);
  });

  it('should verify basic TypeScript compilation', () => {
    const test: string = 'hello';
    expect(test).toBe('hello');
  });
});