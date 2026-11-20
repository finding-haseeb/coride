import { describe, expect, test } from "@jest/globals";
import { interestSimilarity, matchScore, istParts } from "../src/services/pathService.js";
import { parseRating } from "../src/services/reviewService.js";
import { currentStreak } from "../src/services/statsService.js";
import { screenMessage } from "../src/ai/moderation.js";
import { parseTripRules, resolveStation } from "../src/ai/tripParser.js";

describe("matching", () => {
  test("interest similarity is Jaccard", () => {
    expect(interestSimilarity(["music", "tech"], ["tech", "yoga"])).toBeCloseTo(1 / 3);
    expect(interestSimilarity([], ["tech"])).toBe(0);
  });

  test("full overlap at the same time scores higher than a partial late match", () => {
    const base = { queryLength: 10, threshold: 120, rating: 0, ratingCount: 0 };
    const best = matchScore({ ...base, overlap: 10, timeDiff: 0, interests: 1 });
    const weak = matchScore({ ...base, overlap: 3, timeDiff: 100, interests: 0 });
    expect(best).toBeGreaterThan(weak);
    expect(best).toBeLessThanOrEqual(100);
    expect(weak).toBeGreaterThanOrEqual(0);
  });

  test("IST weekday and minutes", () => {
    // 2026-11-15 03:30 UTC = Sunday 09:00 IST
    expect(istParts(new Date("2026-11-15T03:30:00Z"))).toMatchObject({ day: 0, minutes: 540 });
  });
});

describe("reviews", () => {
  test.each([1, 3, 5, "4"])("accepts %p", (v) => expect(parseRating(v)).toBe(Number(v)));
  test.each([0, 6, 2.5, "abc", null])("rejects %p", (v) => expect(() => parseRating(v)).toThrow());
});

describe("streaks", () => {
  const now = new Date("2026-11-15T06:00:00Z");
  test("counts consecutive IST days ending today", () => {
    const dates = ["2026-11-15T03:00:00Z", "2026-11-14T03:00:00Z", "2026-11-13T03:00:00Z", "2026-11-10T03:00:00Z"];
    expect(currentStreak(dates, now)).toBe(3);
  });
  test("still counts when the last ride was yesterday", () => {
    expect(currentStreak(["2026-11-14T03:00:00Z"], now)).toBe(1);
  });
  test("zero when there is a gap", () => {
    expect(currentStreak(["2026-11-12T03:00:00Z"], now)).toBe(0);
  });
});

describe("moderation", () => {
  test("blocks scam with short link", () => {
    expect(screenMessage("send your OTP to bit.ly/abc").action).toBe("block");
  });
  test("allows normal chat", () => {
    expect(screenMessage("Meet at Rajiv Chowk gate 5 at 9?").action).toBe("allow");
  });
});

describe("trip parser (rules)", () => {
  const now = new Date(2026, 10, 15, 10, 0);
  test("Hinglish: kal subah 9 baje X se Y", () => {
    expect(parseTripRules("Kal subah 9 baje Rajiv Chowk se Noida Sec 62", now)).toMatchObject({
      from: "Rajiv Chowk",
      to: "Noida Sector 62",
      departure: "2026-11-16T09:00",
    });
  });
  test("English with alias and pm", () => {
    expect(parseTripRules("cp to hauz khas at 6 pm", now)).toMatchObject({
      from: "Rajiv Chowk",
      to: "Hauz Khas",
      departure: "2026-11-15T18:00",
    });
  });
  test("unknown station resolves to null", () => {
    expect(resolveStation("Atlantis")).toBeNull();
  });
});
