import { time } from "../../lib/utils/time";

describe("Test time util", () => {
  test("time A before time B", () => {
    const timeA = "2017-06-14 03:01:56";
    const timeB = "2017-06-15 03:01:56";

    const isLater = time(timeA).laterThan(time(timeB));
    const expectIsLater = false;

    expect(isLater).toEqual(expectIsLater);
  });

  test("time A later than time B", () => {
    const timeA = "2017-06-20 03:01:56";
    const timeB = "2017-06-15 03:01:56";

    const isLater = time(timeA).laterThan(time(timeB));
    const expectIsLater = true;

    expect(isLater).toEqual(expectIsLater);
  });
});
