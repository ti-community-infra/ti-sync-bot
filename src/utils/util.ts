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

// timeALaterThanTimeB is used to determine that whether time A later than time B.
export function timeALaterThanTimeB(timeAStr: string, timeBStr: string) {
  const timeA = timeAStr !== undefined ? Number(Date.parse(timeAStr)) : 0;
  const timeB = timeBStr !== undefined ? Number(Date.parse(timeBStr)) : 0;

  return timeA > timeB;
}
