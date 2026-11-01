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

it("reproduces the reported contextual sentence without inventing Harper findings", async () => {
  const text = "I wanted to visit mi uncles last nigh";
  const raw = await linter.organizedLints(text, {
    language: "plaintext",
    dedup: false,
  });
  const rawLints = Object.values(raw).flat();
  expect(rawLints).toHaveLength(0);
  rawLints.forEach((lint) => lint.free());
  const issues = await engine.analyze(text, defaults(), seedWords);
  expect(
    issues.find(
      (i) => i.rule === "Time expression review" && i.original === "last nigh",
    ),
  ).toBeDefined();
  expect(
    issues.some((i) => i.replacements.some((r) => /uncle['’]|my/.test(r))),
  ).toBe(false);
});

describe("detection diagnostics and native rule configuration", () => {
  const observed = new Proofreader(linter, { diagnostics: true });
  beforeAll(() => observed.initialize());
  it.each([
    "General English",
    "Academic English",
    "Scientific Writing",
  ] as const)(
    "keeps native spelling, agreement and repetition active in %s",
    async (profile) => {
      const s = defaults();
      s.profile = profile;
      const text =
        "I recieve teh usefull sample. She are happy. The the sample.";
      const issues = await observed.analyze(text, s, seedWords);
      for (const [word, replacement] of [
        ["recieve", "receive"],
        ["usefull", "useful"],
        ["teh", "the"],
      ]) {
        expect(
          issues.some(
            (i) =>
              i.rule === "SpellCheck" &&
              i.original === word &&
              i.replacements.includes(replacement),
          ),
        ).toBe(true);
      }
      expect(
        issues.some(
          (i) => i.original === "are" && i.replacements.includes("is"),
        ),
      ).toBe(true);
      expect(issues.some((i) => i.original === "The the")).toBe(true);
      const report = observed.getDiagnostics()!;
      expect(report.initializationStatus).toBe("ready");
      const nativeDefaults = await linter.getDefaultLintConfig();
      expect([...report.activeRules].sort()).toEqual(
        Object.entries(nativeDefaults)
          .filter(([, on]) => on === true)
          .map(([rule]) => rule)
          .sort(),
      );
      expect(report.activeRules).toEqual(
        expect.arrayContaining([
          "SpellCheck",
          "RepeatedWords",
          "PronounInflectionBe",
        ]),
      );
      expect(report.rawLintCount).toBe(
        report.acceptedLintCount + report.discardedLints.length,
      );
      expect(report.finalIssueCount).toBe(issues.length);
      expect(
        report.discardedLints.filter(
          (i) => i.reason === "source-mismatch" || i.reason === "invalid-span",
        ),
      ).toEqual([]);
    },
  );
  it("attributes the reported sentence to an upstream limitation, not discarded spans", async () => {
    const issues = await observed.analyze(
      "I wanted to visit mi uncles last nigh",
      defaults(),
      seedWords,
    );
    const report = observed.getDiagnostics()!;
    expect(report.rawLintCount).toBe(0);
    expect(report.acceptedLintCount).toBe(0);
    expect(report.discardedLints).toEqual([]);
    expect(report.customIssueCount).toBe(1);
    expect(issues[0].rule).toBe("Time expression review");
    expect(issues[0].replacements).toEqual([]);
    expect(
      await observed.analyze(
        "I wanted to visit mi uncles last night.",
        defaults(),
        seedWords,
      ),
    ).toEqual([]);
  });
  it.each([
    "🧪 I recieve teh usefull sample.",
    "A usefull\r\nsample.",
    "A usefull\u00a0sample.",
    "Cafe\u0301 usefull.",
  ])("retains exact UTF-16 spans without normalizing %s", async (text) => {
    const issues = await observed.analyze(text, defaults(), seedWords);
    const report = observed.getDiagnostics()!;
    expect(report.rawLintCount).toBeGreaterThan(0);
    expect(
      report.discardedLints.filter((i) =>
        ["source-mismatch", "invalid-span"].includes(i.reason),
      ),
    ).toEqual([]);
    for (const raw of report.rawLints)
      expect(raw.problemText).toBe(text.slice(raw.start, raw.end));
    expect(issues.some((i) => i.original === "usefull")).toBe(true);
  });
  it("reports applied overrides/ignored rules and dictionary/ignored-word discards separately", async () => {
    const s = defaults();
    s.overrides.SpellCheck = false;
    s.ignoredRules = ["The"];
    await observed.analyze("recieve teh usefull", s, []);
    expect(observed.getDiagnostics()!.activeRules).not.toContain("SpellCheck");
    expect(observed.getDiagnostics()!.activeRules).not.toContain("The");
    const accepted = defaults();
    accepted.ignoredWords = ["recieve"];
    await observed.analyze("recieve usefull", accepted, ["usefull"]);
    const discarded = observed.getDiagnostics()!.discardedLints;
    expect(
      discarded.some(
        (d) => d.rule === "SpellCheck" && d.reason === "dictionary-term",
      ),
    ).toBe(true);
    expect(
      discarded.some(
        (d) => d.rule === "SpellCheck" && d.reason === "ignored-word",
      ),
    ).toBe(true);
  });
  it("does not capture diagnostics unless explicitly enabled by its caller", async () => {
    await engine.analyze("A usefull sample.", defaults(), []);
    expect(engine.getDiagnostics()).toBeUndefined();
  });
});
