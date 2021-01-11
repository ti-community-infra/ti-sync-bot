import { DeprecatedLogger } from "probot/lib/types";

// sleep used to pause execution for specified time, the unit is milliseconds.
export function sleep(time = 0) {
  return new Promise((resolve, _) => {
    setTimeout(() => {
      resolve(null);
    }, time);
  });
}

// getChildLogger is the tool method to generate the child logger and to fix the `this` lost problem.
export function getChildLogger(
  logger: DeprecatedLogger,
  name: string,
  level: string
) {
  const childLogger = logger.child({ name: name, level: level });

  return {
    debug: childLogger.debug.bind(childLogger),
    info: childLogger.info.bind(childLogger),
    warn: childLogger.warn.bind(childLogger),
    error: childLogger.error.bind(childLogger),
  };
}

// TODO: add time comparison util function.
// isBefore is used to determine that whether time A before time B.
export function isBefore(timeA: string, timeB: string) {
  return Number(Date.parse(timeA)) < Number(Date.parse(timeB));
}
