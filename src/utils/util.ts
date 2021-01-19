import { Logger } from "probot";

/**
 * Pause execution for specified interval.
 * @param time The time unit is milliseconds.
 */
export function sleep(time = 0) {
  return new Promise((resolve, _) => {
    setTimeout(() => {
      resolve(null);
    }, time);
  });
}

/**
 * Generate the child logger.
 * Notice: This function is used to fix the `this` lost problem.
 * @param logger Parent logger.
 * @param name The name of child logger.
 * @param level The level of child logger.
 */
export function getChildLogger(logger: Logger, name: string, level: string) {
  const childLogger = logger.child({ name: name, level: level });

  return {
    debug: childLogger.debug.bind(childLogger),
    info: childLogger.info.bind(childLogger),
    warn: childLogger.warn.bind(childLogger),
    error: childLogger.error.bind(childLogger),
  };
}
