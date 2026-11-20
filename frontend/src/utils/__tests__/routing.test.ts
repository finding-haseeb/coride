import { describe, expect, test } from "vitest";
import djikstra, { type Graph } from "../djikstra";
import { SuffixAutomaton } from "../SuffixAutomaton";

const g: Graph = {
  A: { lat: 0, lng: 0, line: "x", neighbors: { B: 1, C: 5 } },
  B: { lat: 0, lng: 0, line: "x", neighbors: { A: 1, C: 1 } },
  C: { lat: 0, lng: 0, line: "x", neighbors: { A: 5, B: 1, D: 1 } },
  D: { lat: 0, lng: 0, line: "x", neighbors: { C: 1 } },
};

describe("dijkstra", () => {
  test("takes the shorter two-hop path", () => {
    expect(djikstra(g, "A", "D")).toEqual(["A", "B", "C", "D"]);
  });
});

describe("suffix automaton", () => {
  test("builds one state per prefix at least", () => {
    const ids = new Map([["A", 1], ["B", 2], ["C", 3], ["D", 4]]);
    const sa = new SuffixAutomaton(["A", "B", "C", "D"], ids);
    expect(sa.st.length).toBeGreaterThanOrEqual(5);
    // the full route is readable from the start state
    let s = 0;
    for (const id of [1, 2, 3, 4]) {
      expect(sa.st[s].next.has(id)).toBe(true);
      s = sa.st[s].next.get(id)!;
    }
  });
});
