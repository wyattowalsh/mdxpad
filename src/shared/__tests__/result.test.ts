/**
 * Comprehensive tests for Result<T,E> monad.
 * Tests all operations: ok, err, map, mapErr, andThen, orElse, unwrap, unwrapOr, unwrapErr, match, isOk, isErr.
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  orElse,
  unwrap,
  unwrapOr,
  unwrapErr,
  match,
  type Result,
} from '@shared/lib/result';

describe('Result<T,E> monad', () => {
  describe('ok()', () => {
    it('should create a successful Result', () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it('should handle different value types', () => {
      expect(ok('hello')).toEqual({ ok: true, value: 'hello' });
      expect(ok({ id: 1 })).toEqual({ ok: true, value: { id: 1 } });
      expect(ok(null)).toEqual({ ok: true, value: null });
      expect(ok(undefined)).toEqual({ ok: true, value: undefined });
    });
  });

  describe('err()', () => {
    it('should create a failed Result', () => {
      const error = new Error('Failed');
      const result = err(error);
      expect(result).toEqual({ ok: false, error });
    });

    it('should handle different error types', () => {
      expect(err('string error')).toEqual({ ok: false, error: 'string error' });
      expect(err(404)).toEqual({ ok: false, error: 404 });
      expect(err({ code: 'ERR_NOT_FOUND' })).toEqual({
        ok: false,
        error: { code: 'ERR_NOT_FOUND' },
      });
    });
  });

  describe('isOk()', () => {
    it('should return true for successful Results', () => {
      expect(isOk(ok(42))).toBe(true);
    });

    it('should return false for failed Results', () => {
      expect(isOk(err(new Error('Failed')))).toBe(false);
    });

    it('should act as type guard', () => {
      const result: Result<number, Error> = ok(42);
      if (isOk(result)) {
        // Type should be narrowed to { ok: true; value: number }
        expect(result.value).toBe(42);
      }
    });
  });

  describe('isErr()', () => {
    it('should return false for successful Results', () => {
      expect(isErr(ok(42))).toBe(false);
    });

    it('should return true for failed Results', () => {
      expect(isErr(err(new Error('Failed')))).toBe(true);
    });

    it('should act as type guard', () => {
      const result: Result<number, Error> = err(new Error('Failed'));
      if (isErr(result)) {
        // Type should be narrowed to { ok: false; error: Error }
        expect(result.error.message).toBe('Failed');
      }
    });
  });

  describe('map()', () => {
    it('should transform successful Result value', () => {
      const result = ok(42);
      const mapped = map(result, (n) => n * 2);
      expect(mapped).toEqual({ ok: true, value: 84 });
    });

    it('should preserve failed Result', () => {
      const error = new Error('Failed');
      const result = err(error);
      const mapped = map(result, (n: number) => n * 2);
      expect(mapped).toEqual({ ok: false, error });
    });

    it('should chain multiple map operations', () => {
      const result = ok(10);
      const mapped = map(
        map(result, (n) => n * 2),
        (n) => n + 5
      );
      expect(mapped).toEqual({ ok: true, value: 25 });
    });

    it('should handle type transformations', () => {
      const result = ok(42);
      const mapped = map(result, (n) => `number: ${n}`);
      expect(mapped).toEqual({ ok: true, value: 'number: 42' });
    });
  });

  describe('mapErr()', () => {
    it('should preserve successful Result', () => {
      const result = ok(42);
      const mapped = mapErr(result, (e: Error) => e.message);
      expect(mapped).toEqual({ ok: true, value: 42 });
    });

    it('should transform failed Result error', () => {
      const result = err(new Error('Failed'));
      const mapped = mapErr(result, (e) => e.message);
      expect(mapped).toEqual({ ok: false, error: 'Failed' });
    });

    it('should chain multiple mapErr operations', () => {
      const result = err('error');
      const mapped = mapErr(
        mapErr(result, (e) => `${e}!`),
        (e) => e.toUpperCase()
      );
      expect(mapped).toEqual({ ok: false, error: 'ERROR!' });
    });
  });

  describe('andThen()', () => {
    it('should chain successful Results', () => {
      const result = ok(10);
      const chained = andThen(result, (n) => ok(n * 2));
      expect(chained).toEqual({ ok: true, value: 20 });
    });

    it('should short-circuit on first error', () => {
      const error = new Error('First error');
      const result = err(error);
      const chained = andThen(result, (n: number) => ok(n * 2));
      expect(chained).toEqual({ ok: false, error });
    });

    it('should propagate error from chained function', () => {
      const result = ok(10);
      const error = new Error('Second error');
      const chained = andThen(result, () => err(error));
      expect(chained).toEqual({ ok: false, error });
    });

    it('should chain multiple operations', () => {
      const result = ok(5);
      const chained = andThen(
        andThen(result, (n) => ok(n * 2)),
        (n) => ok(n + 10)
      );
      expect(chained).toEqual({ ok: true, value: 20 });
    });

    it('should handle real-world validation chain', () => {
      const validatePositive = (n: number): Result<number, string> =>
        n > 0 ? ok(n) : err('Must be positive');
      const validateLessThan100 = (n: number): Result<number, string> =>
        n < 100 ? ok(n) : err('Must be less than 100');

      const valid = andThen(ok(50), validatePositive);
      const validChain = andThen(valid, validateLessThan100);
      expect(validChain).toEqual({ ok: true, value: 50 });

      const invalid = andThen(ok(-5), validatePositive);
      expect(invalid).toEqual({ ok: false, error: 'Must be positive' });
    });
  });

  describe('orElse()', () => {
    it('should preserve successful Result', () => {
      const result = ok(42);
      const fallback = orElse(result, () => ok(0));
      expect(fallback).toEqual({ ok: true, value: 42 });
    });

    it('should provide fallback for failed Result', () => {
      const result = err(new Error('Failed'));
      const fallback = orElse(result, () => ok(0));
      expect(fallback).toEqual({ ok: true, value: 0 });
    });

    it('should allow fallback to propagate error', () => {
      const result = err('first error');
      const fallback = orElse(result, () => err('second error'));
      expect(fallback).toEqual({ ok: false, error: 'second error' });
    });

    it('should transform error type', () => {
      const result = err(404);
      const fallback = orElse(result, (code) => err(`Error code: ${code}`));
      expect(fallback).toEqual({ ok: false, error: 'Error code: 404' });
    });
  });

  describe('unwrap()', () => {
    it('should return value for successful Result', () => {
      const result = ok(42);
      expect(unwrap(result)).toBe(42);
    });

    it('should throw error for failed Result', () => {
      const error = new Error('Failed');
      const result = err(error);
      expect(() => unwrap(result)).toThrow(error);
    });

    it('should throw string error', () => {
      const result = err('Failed');
      expect(() => unwrap(result)).toThrow('Failed');
    });
  });

  describe('unwrapOr()', () => {
    it('should return value for successful Result', () => {
      const result = ok(42);
      expect(unwrapOr(result, 0)).toBe(42);
    });

    it('should return default for failed Result', () => {
      const result = err(new Error('Failed'));
      expect(unwrapOr(result, 0)).toBe(0);
    });

    it('should handle different default types', () => {
      expect(unwrapOr(err('error'), 'default')).toBe('default');
      expect(unwrapOr(err('error'), { id: 0 })).toEqual({ id: 0 });
    });
  });

  describe('unwrapErr()', () => {
    it('should return error for failed Result', () => {
      const error = new Error('Failed');
      const result = err(error);
      expect(unwrapErr(result)).toBe(error);
    });

    it('should throw for successful Result', () => {
      const result = ok(42);
      expect(() => unwrapErr(result)).toThrow('Called unwrapErr on Ok result');
    });
  });

  describe('match()', () => {
    it('should call ok handler for successful Result', () => {
      const result = ok(42);
      const output = match(result, {
        ok: (value) => `Success: ${value}`,
        err: (error) => `Error: ${error}`,
      });
      expect(output).toBe('Success: 42');
    });

    it('should call err handler for failed Result', () => {
      const result = err(new Error('Failed'));
      const output = match(result, {
        ok: (value) => `Success: ${value}`,
        err: (error) => `Error: ${error.message}`,
      });
      expect(output).toBe('Error: Failed');
    });

    it('should return different types from handlers', () => {
      const result = ok(42);
      const output = match(result, {
        ok: (value) => value * 2,
        err: () => 0,
      });
      expect(output).toBe(84);
    });

    it('should handle exhaustive pattern matching', () => {
      const handleResult = (result: Result<number, string>): string =>
        match(result, {
          ok: (n) => `Got number: ${n}`,
          err: (e) => `Got error: ${e}`,
        });

      expect(handleResult(ok(42))).toBe('Got number: 42');
      expect(handleResult(err('failed'))).toBe('Got error: failed');
    });
  });

  describe('edge cases', () => {
    it('should handle null and undefined values', () => {
      expect(ok(null)).toEqual({ ok: true, value: null });
      expect(ok(undefined)).toEqual({ ok: true, value: undefined });
      expect(map(ok(null), () => 42)).toEqual({ ok: true, value: 42 });
    });

    it('should handle zero and false values', () => {
      expect(ok(0)).toEqual({ ok: true, value: 0 });
      expect(ok(false)).toEqual({ ok: true, value: false });
      expect(unwrapOr(ok(0), 42)).toBe(0);
      expect(unwrapOr(ok(false), true)).toBe(false);
    });

    it('should handle empty strings', () => {
      expect(ok('')).toEqual({ ok: true, value: '' });
      expect(map(ok(''), (s) => s.length)).toEqual({ ok: true, value: 0 });
    });

    it('should handle complex nested structures', () => {
      const complexValue = { users: [{ id: 1, name: 'Alice' }], metadata: { count: 1 } };
      const result = ok(complexValue);
      expect(unwrap(result)).toEqual(complexValue);
    });
  });

  describe('real-world usage patterns', () => {
    it('should simulate file read operation', () => {
      const readFile = (path: string): Result<string, Error> => {
        if (path === '/valid/path.txt') {
          return ok('file contents');
        }
        return err(new Error('File not found'));
      };

      const validRead = readFile('/valid/path.txt');
      expect(isOk(validRead)).toBe(true);
      expect(unwrap(validRead)).toBe('file contents');

      const invalidRead = readFile('/invalid/path.txt');
      expect(isErr(invalidRead)).toBe(true);
      expect(() => unwrap(invalidRead)).toThrow('File not found');
    });

    it('should simulate parsing operation', () => {
      const parseJSON = (input: string): Result<unknown, Error> => {
        try {
          return ok(JSON.parse(input));
        } catch (e) {
          return err(e as Error);
        }
      };

      const valid = parseJSON('{"key": "value"}');
      expect(unwrap(valid)).toEqual({ key: 'value' });

      const invalid = parseJSON('invalid json');
      expect(isErr(invalid)).toBe(true);
    });

    it('should chain multiple fallible operations', () => {
      const divide = (a: number, b: number): Result<number, string> =>
        b === 0 ? err('Division by zero') : ok(a / b);

      const sqrt = (n: number): Result<number, string> =>
        n < 0 ? err('Cannot take square root of negative') : ok(Math.sqrt(n));

      const compute = (a: number, b: number): Result<number, string> => andThen(divide(a, b), sqrt);

      expect(compute(16, 4)).toEqual({ ok: true, value: 2 });
      expect(compute(16, 0)).toEqual({ ok: false, error: 'Division by zero' });
      expect(compute(-16, 4)).toEqual({ ok: false, error: 'Cannot take square root of negative' });
    });
  });
});
