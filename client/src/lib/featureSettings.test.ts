import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_SETTINGS, normalizeFeatureSettings } from "./featureSettings";

describe("user feature settings", () => {
  it("defaults optional high-impact features to off", () => {
    expect(DEFAULT_FEATURE_SETTINGS.visualQualityCheck).toBe(false);
    expect(DEFAULT_FEATURE_SETTINGS.githubSync).toBe(false);
    expect(DEFAULT_FEATURE_SETTINGS.collaboration).toBe(false);
  });
  it("preserves boolean overrides and ignores invalid stored values", () => {
    const settings = normalizeFeatureSettings({ prewarmRuntime: false, reviewerAgent: true, githubSync: "true", unknown: true });
    expect(settings.prewarmRuntime).toBe(false);
    expect(settings.reviewerAgent).toBe(true);
    expect(settings.githubSync).toBe(false);
    expect(Object.keys(settings)).toEqual(Object.keys(DEFAULT_FEATURE_SETTINGS));
  });
});
