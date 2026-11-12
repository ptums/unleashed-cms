import { fitToLimit } from "../lambda/ai/fit";

describe("fitToLimit", () => {
  it("leaves text under the limit alone", () => {
    expect(fitToLimit("EMDR Therapy in Huntington, NY", 60)).toBe("EMDR Therapy in Huntington, NY");
  });

  it("cuts a long title at the last word break", () => {
    const title = "Nervous System Regulation: Understanding Your Body's Stress Response";
    const fitted = fitToLimit(title, 60);
    expect(fitted.length).toBeLessThanOrEqual(60);
    expect(fitted).toBe("Nervous System Regulation: Understanding Your Body's Stress");
  });

  it("drops a dash or colon left at the end of the cut", () => {
    expect(fitToLimit("Grief and Loss Support - Finding Your Way", 24)).toBe("Grief and Loss Support");
  });

  it("cuts a single long word at the limit", () => {
    expect(fitToLimit("a".repeat(70), 60)).toHaveLength(60);
  });
});
