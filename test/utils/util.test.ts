import { timeALaterThanTimeB } from "../../lib/utils/util";

describe("Test util", () => {
  test("[timeALaterThanTimeB]: time A before time B", () => {
    const timeA = "2017-06-14 03:01:56";
    const timeB = "2017-06-15 03:01:56";
    const expectIsLater = false;
    const isLater = timeALaterThanTimeB(timeA, timeB);

    expect(isLater).toEqual(expectIsLater);
  });

  test("[timeALaterThanTimeB]: time A later than time B", () => {
    const timeA = "2017-06-20 03:01:56";
    const timeB = "2017-06-15 03:01:56";
    const expectIsLater = true;
    const isLater = timeALaterThanTimeB(timeA, timeB);

    expect(isLater).toEqual(expectIsLater);
  });
});
