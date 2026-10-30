import { describe, it, expect } from "vitest";
import {
  applyCorrection,
  applyMany,
  defaults,
  enabled,
  exportDictionary,
  issue,
  parseDictionary,
  protectedRanges,
  seedWords,
} from "./model";
import { scientific } from "./scientific";
describe("correction offsets", () => {
  it("uses UTF-16 offsets including emoji and checks staleness", () => {
    const text = "🧪 a usefull sample";
    const start = text.indexOf("usefull");
    const i = issue(
      "test",
      "Spelling",
      start,
      start + 7,
      text,
      ["useful"],
      "Spelling",
    );
    expect(applyCorrection(text, i, "useful")).toBe("🧪 a useful sample");
    expect(() => applyCorrection("changed", i, "useful")).toThrow("stale");
  });
  it("applies simultaneous nonoverlapping corrections right to left", () => {
    const text = "bad bad";
    const a = issue("a", "Grammar", 0, 3, text, ["good"], "");
    const b = issue("b", "Grammar", 4, 7, text, ["excellent"], "");
    expect(
      applyMany(text, [
        { issue: a, replacement: "good" },
        { issue: b, replacement: "excellent" },
      ]),
    ).toBe("good excellent");
    expect(() =>
      applyMany(text, [
        { issue: a, replacement: "" },
        { issue: a, replacement: "" },
      ]),
    ).toThrow("Overlapping");
  });
});
describe("dictionary", () => {
  it("roundtrips JSON and TXT with case preserved", () => {
    for (const f of ["txt", "json"] as const)
      expect(parseDictionary(exportDictionary(seedWords, f), f)).toEqual(
        seedWords,
      );
    expect(parseDictionary('["PFAS","pfas","PFAS"]', "json")).toEqual([
      "PFAS",
      "pfas",
    ]);
  });
  it("rejects malformed imports and executable objects", () => {
    expect(() => parseDictionary('{"word":"PFAS"}', "json")).toThrow();
    expect(() => parseDictionary("[1]", "json")).toThrow();
    expect(() => parseDictionary("x".repeat(1000001), "txt")).toThrow();
  });
});
describe("profiles and conservative science checks", () => {
  it("has override and ignored-rule precedence", () => {
    const s = defaults();
    s.profile = "General English";
    expect(enabled("SI spacing", s)).toBe(false);
    s.overrides["SI spacing"] = true;
    expect(enabled("SI spacing", s)).toBe(true);
    s.ignoredRules.push("SI spacing");
    expect(enabled("SI spacing", s)).toBe(false);
  });
  it("flags only selected conventions and never offers replacements for numeric or scientific review", () => {
    const text =
      "PFAS and pfas were measured at 10mg. The result was statistically significant (p = 0.05). H2O and MYB-NFIB were unchanged.";
    const issues = scientific(text, defaults(), seedWords);
    expect(issues.map((i) => i.rule)).toEqual(
      expect.arrayContaining([
        "SI spacing",
        "Abbreviation consistency",
        "Terminology convention",
      ]),
    );
    for (const i of issues) {
      expect(text.slice(i.start, i.end)).toBe(i.original);
      expect(i.replacements).toEqual([]);
    }
    expect(issues.some((i) => /H2O|MYB-NFIB|0.05/.test(i.original))).toBe(
      false,
    );
  });
  it("finds repeated words and redundancy without changing results", () => {
    const text =
      "The the sample was measured in order to compare groups at 3.14 mg.";
    const issues = scientific(text, defaults(), seedWords);
    expect(
      issues.find((i) => i.rule === "Repeated words")?.replacements,
    ).toEqual(["The"]);
    expect(
      issues.find((i) => i.rule === "Academic redundancy")?.replacements,
    ).toEqual(["to"]);
    expect(
      scientific(
        "The sample contained 3.14 mg of PFHxA.",
        defaults(),
        seedWords,
      ),
    ).toEqual([]);
  });
  it("protects gene names, formulae and values", () => {
    const t = "MYB-NFIB H2O PFHxA 0.05";
    const ranges = protectedRanges(t);
    for (const term of ["MYB-NFIB", "H2O", "PFHxA", "0.05"])
      expect(
        ranges.some(
          ([a, b]) =>
            a <= t.indexOf(term) && b >= t.indexOf(term) + term.length,
        ),
      ).toBe(true);
  });
});
