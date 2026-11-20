import { describe, expect, test } from "vitest";
import type { Graph } from "../../pages/map_page/types";
import { advanceByTime, alarmStops, dueAlarm, journeyView, locateOnRoute } from "../journey";

// A straight line going north, ~1.1 km between stops.
const g: Graph = {
  A: { lat: 28.6, lng: 77.2, line: "yellow-400", neighbors: { B: 1.1 } },
  B: { lat: 28.61, lng: 77.2, line: "yellow-400", neighbors: { A: 1.1, C: 1.1 } },
  C: { lat: 28.62, lng: 77.2, line: "yellow-400", neighbors: { B: 1.1, D: 1.1 } },
  D: { lat: 28.63, lng: 77.2, line: "yellow-400", neighbors: { C: 1.1 } },
};
const path = ["A", "B", "C", "D"];

describe("journey", () => {
  test("snaps GPS onto the route", () => {
    const at = locateOnRoute(path, g, 28.615, 77.2001)!;
    expect(at.progress).toBeCloseTo(1.5, 1);
    expect(at.offRouteM).toBeLessThan(20);
  });

  test("current and next station", () => {
    expect(journeyView(1.02, 4)).toMatchObject({ atIndex: 1, atStation: true, nextIndex: 2, stopsLeft: 2 });
    expect(journeyView(1.5, 4)).toMatchObject({ atIndex: 1, atStation: false, nextIndex: 2 });
    expect(journeyView(3, 4)).toMatchObject({ atIndex: 3, nextIndex: null, stopsLeft: 0 });
  });

  test("alarm rings one stop before the destination, once", () => {
    const alarms = alarmStops(path, g);
    expect(alarms).toEqual([3]);
    const done = new Set<number>();
    expect(dueAlarm(1.2, alarms, done)).toBeNull();
    expect(dueAlarm(1.9, alarms, done)).toBe(3);
    done.add(3);
    expect(dueAlarm(2.5, alarms, done)).toBeNull();
  });

  test("interchange gets its own alarm", () => {
    const g2: Graph = {
      ...g,
      C: { ...g.C, line: "black" },
      D: { ...g.D, line: "blue-400", neighbors: { C: 1.1, E: 1 } },
      E: { lat: 28.64, lng: 77.2, line: "blue-400", neighbors: { D: 1 } },
    };
    expect(alarmStops(["A", "B", "C", "D", "E"], g2)).toEqual([2, 4]);
  });

  test("time estimate moves forward and stops at the end", () => {
    expect(advanceByTime(0, 90_000, [90_000, 90_000])).toBeCloseTo(1);
    expect(advanceByTime(0, 10 ** 9, [90_000, 90_000])).toBe(2);
  });
});
