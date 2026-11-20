import { describe, expect, test } from "vitest";
import {
  estimateCrowd,
  estimateFare,
  lessCrowdedTime,
  looksRisky,
  meetupMessage,
  parseMeetup,
  servicePeriod,
  typicalWait,
} from "../metroInfo";

// Local times; 2026-11-16 is a Monday, 2026-11-15 a Sunday.
const mon = (h: number, m = 0) => new Date(2026, 10, 16, h, m);
const sun = (h: number, m = 0) => new Date(2026, 10, 15, h, m);

describe("fare", () => {
  test("weekday slabs", () => {
    expect(estimateFare(1.5, mon(10)).fare).toBe(11);
    expect(estimateFare(10, mon(10)).fare).toBe(32);
    expect(estimateFare(40, mon(10)).fare).toBe(64);
  });
  test("Sunday is cheaper and smart card is 10% off", () => {
    const f = estimateFare(10, sun(10));
    expect(f).toEqual({ fare: 21, smartCard: 19, reducedDay: true });
  });
});

describe("service and crowd", () => {
  test("periods", () => {
    expect(servicePeriod(mon(9))).toBe("peak");
    expect(servicePeriod(mon(14))).toBe("day");
    expect(servicePeriod(mon(2))).toBe("closed");
    expect(servicePeriod(sun(9))).toBe("day");
  });
  test("wait is the slowest line", () => {
    expect(typicalWait(["yellow-400", "aqua"], mon(9))).toBe(6);
    expect(typicalWait(["yellow-400"], mon(2))).toBeNull();
  });
  test("busy interchanges at peak are very high", () => {
    expect(estimateCrowd(["Rajiv Chowk", "Mandi House"], mon(9))).toBe("Very high");
    expect(estimateCrowd(["Dwarka"], sun(14))).toBe("Low");
  });
  test("suggests leaving before the peak", () => {
    const tip = lessCrowdedTime(["Rajiv Chowk", "Mandi House"], mon(8, 10));
    expect(tip).not.toBeNull();
    expect(tip!.diffMin).toBe(-15);
  });
  test("no tip when already quiet", () => {
    expect(lessCrowdedTime(["Dwarka"], sun(14))).toBeNull();
  });
});

describe("chat helpers", () => {
  test("meetup round-trip", () => {
    expect(parseMeetup(meetupMessage("Rajiv Chowk", "gate 5"))).toEqual({ station: "Rajiv Chowk", note: "gate 5" });
    expect(parseMeetup("hello")).toBeNull();
  });
  test("risky text", () => {
    expect(looksRisky("share your OTP please")).toBe(true);
    expect(looksRisky("see you at 9")).toBe(false);
  });
});
