import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import { defaults, seedWords, applyCorrection } from "./model";
const linter = new LocalLinter({ binary });
const engine = new Proofreader(linter);
beforeAll(() => engine.initialize(), 30000);
afterAll(() => linter.dispose());
describe("real Harper integration (no mocked findings)", () => {
  it("returns Unicode-accurate spelling and supported agreement", async () => {
    const text = "🧪 This is a usefull observation. She are happy.";
    const issues = await engine.analyze(text, defaults(), seedWords);
    const spelling = issues.find(
      (i) => i.rule === "SpellCheck" && i.original === "usefull",
    );
    expect(spelling?.replacements).toContain("useful");
    expect(spelling?.start).toBe(text.indexOf("usefull"));
    for (const i of issues) expect(text.slice(i.start, i.end)).toBe(i.original);
    expect(
      issues.some((i) => i.category === "Grammar" && i.original === "are"),
    ).toBe(true);
    expect(applyCorrection(text, spelling!, "useful")).toContain(
      "🧪 This is a useful observation.",
    );
  });
  it("disables actual Harper rules and honors accepted terms", async () => {
    const s = defaults();
    s.overrides.SpellCheck = false;
    expect(
      (await engine.analyze("A usefull observation.", s, [])).some(
        (i) => i.category === "Spelling",
      ),
    ).toBe(false);
    expect(
      (
        await engine.analyze("We measured xenofluxomics.", defaults(), [
          "xenofluxomics",
        ])
      ).some(
        (i) => i.category === "Spelling" && i.original === "xenofluxomics",
      ),
    ).toBe(false);
    expect(
      (await engine.analyze("We measured xenofluxomics.", defaults(), [])).some(
        (i) => i.category === "Spelling" && i.original === "xenofluxomics",
      ),
    ).toBe(true);
  });
  it("preserves case-sensitive whole terms and scientific identifiers", async () => {
    const text =
      "We measured hepatotoxicity, PFHxA, H2O, and MYB-NFIB at p = 0.05.";
    const issues = await engine.analyze(text, defaults(), seedWords);
    expect(issues.filter((i) => i.category === "Spelling")).toEqual([]);
    expect(
      issues
        .filter((i) => i.replacements.length)
        .some((i) => /PFHxA|H2O|MYB-NFIB|0\.05/.test(i.original)),
    ).toBe(false);
    const lower = await engine.analyze(
      "We measured xenofluxomics.",
      defaults(),
      ["Xenofluxomics"],
    );
    expect(
      lower.some(
        (i) => i.original === "xenofluxomics" && i.category === "Spelling",
      ),
    ).toBe(true);
  });
  it("changes US/UK dialect using Harper", async () => {
    const s = defaults();
    s.dialect = "UK";
    const uk = await engine.analyze("The colour of the sample.", s, []);
    expect(
      uk.filter((i) => i.category === "Spelling" && i.original === "colour"),
    ).toEqual([]);
    s.dialect = "US";
    const us = await engine.analyze("The colour of the sample.", s, []);
    expect(
      us.some((i) => i.original === "colour" && i.category === "Spelling"),
    ).toBe(true);
  });
});
