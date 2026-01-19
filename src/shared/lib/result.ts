/**
 * Result type - Functional error handling monad.
 * All operations that can fail MUST return Result.
 * Enables exhaustive pattern matching and explicit error handling.
 */

/** Success variant of Result */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/** Error variant of Result */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Discriminated union for success/failure outcomes.
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Create a successful Result.
 * @param value - The success value
 * @returns Result with ok: true
 * @example
 * const result = ok(42);
 * // { ok: true, value: 42 }
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failed Result.
 * @param error - The error value
 * @returns Result with ok: false
 * @example
 * const result = err(new Error('Failed'));
 * // { ok: false, error: Error('Failed') }
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Check if Result is successful.
 * Type guard that narrows to success type.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Check if Result is an error.
 * Type guard that narrows to error type.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Map over a successful Result value.
 * @param result - The Result to map
 * @param fn - Transform function for success value
 * @returns New Result with transformed value or original error
 */
export function map<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return err(result.error);
}

/**
 * Map over a failed Result error.
 * @param result - The Result to map
 * @param fn - Transform function for error value
 * @returns New Result with transformed error or original value
 */
export function mapErr<T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return ok(result.value);
}

/**
 * Chain Results together (flatMap).
 * @param result - The Result to chain
 * @param fn - Function returning new Result
 * @returns Chained Result
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return err(result.error);
}

/**
 * Chain Results together (alias for andThen).
 * @param result - The Result to chain
 * @param fn - Function returning new Result
 * @returns Chained Result
 */
export function flatMap<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return andThen(result, fn);
}

/**
 * Provide fallback for error case.
 * @param result - The Result to handle
 * @param fn - Function returning fallback Result
 * @returns Original or fallback Result
 */
export function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  if (isErr(result)) {
    return fn(result.error);
  }
  return ok(result.value);
}

/**
 * Unwrap Result or throw.
 * @param result - The Result to unwrap
 * @returns The success value
 * @throws The error if Result is not ok
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  // Wrap non-Error values in an Error for proper throwing
  if (result.error instanceof Error) {
    throw result.error;
  }
  throw new Error(String(result.error));
}

/**
 * Unwrap Result or return default.
 * @param result - The Result to unwrap
 * @param defaultValue - Value to return if error
 * @returns The success value or default
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * Unwrap error or throw.
 * @param result - The Result to unwrap
 * @returns The error value
 * @throws Error if Result is ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error('Called unwrapErr on Ok result');
}

/**
 * Match on Result with pattern matching.
 * @param result - The Result to match
 * @param handlers - Object with ok and err handlers
 * @returns Result of matching handler
 */
export function match<T, E, U>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => U;
    err: (error: E) => U;
  }
): U {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }
  return handlers.err(result.error);
}
