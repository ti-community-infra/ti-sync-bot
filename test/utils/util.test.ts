import { isBefore } from "../../lib/utils/util";

describe("Test util", () => {
  test("[isBefore]: time A before time B", () => {
    const timeA = "2017-06-14 03:01:56";
    const timeB = "2017-06-15 03:01:56";
    const expectIsBefore = true;

    let isBeforeReturn = isBefore(timeA, timeB);

    expect(isBeforeReturn).toEqual(expectIsBefore);
  });

  test("[isBefore]: time A later than time B", () => {
    const timeA = "2017-06-20 03:01:56";
    const timeB = "2017-06-15 03:01:56";
    const expectIsBefore = false;

    let isBeforeReturn = isBefore(timeA, timeB);

    expect(isBeforeReturn).toEqual(expectIsBefore);
  });
});
