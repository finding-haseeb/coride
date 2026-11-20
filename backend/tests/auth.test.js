import { describe, expect, test } from "@jest/globals";
import request from "supertest";
import app from "../src/index.js";

describe("protected routes need a token", () => {
  test.each([
    ["post", "/api/trips"],
    ["get", "/api/notifications"],
    ["post", "/api/safety/sos"],
    ["post", "/api/ai/parse-trip"],
    ["get", "/api/groups"],
    ["post", "/api/recurring-trips"],
  ])("%s %s → 401", async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect([401, 403]).toContain(res.status);
  });
});
