import { describe, expect, it } from "vitest";
import { getSafeAppPath } from "./redirects";

describe("getSafeAppPath", () => {
  it("allows internal app paths", () => {
    expect(getSafeAppPath("/app?tab=pickups")).toBe("/app?tab=pickups");
  });

  it("rejects external absolute urls", () => {
    expect(getSafeAppPath("https://evil.example/steal", "/app")).toBe("/app");
  });

  it("rejects protocol-relative paths", () => {
    expect(getSafeAppPath("//evil.example", "/app")).toBe("/app");
  });

  it("falls back when missing", () => {
    expect(getSafeAppPath(null, "/admin")).toBe("/admin");
  });
});
