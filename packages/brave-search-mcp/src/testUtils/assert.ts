import { expect } from 'bun:test';

export const assert = {
  equal(actual: unknown, expected: unknown) {
    expect(actual).toBe(expected);
  },
  deepEqual(actual: unknown, expected: unknown) {
    expect(actual).toEqual(expected);
  },
  ok(value: unknown) {
    expect(value).toBeTruthy();
  },
  match(value: string, pattern: RegExp) {
    expect(value).toMatch(pattern);
  },
};
