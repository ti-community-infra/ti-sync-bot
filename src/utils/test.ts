let scheduler = typeof setImmediate === "function" ? setImmediate : setTimeout;

/**
 * Flush all pending resolved promise handlers. Useful in tests.
 * Usage:
 * ```
 * await flushPromises();
 * ```
 */
export function flushPromises() {
  return new Promise(function (resolve) {
    scheduler(resolve, 0);
  });
}
