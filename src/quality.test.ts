import { beforeAll, afterAll, it, expect } from "vitest";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import {
  defaults,
  seedWords,
  applyCorrection,
  issue,
  applyMany,
} from "./model";
import { aggregateIssues, createScientificPolicy } from "./policy";
import development from "../benchmark/corpus/development.json";
import regression from "../benchmark/corpus/regression.json";
const linter = new LocalLinter({ binary });
const engine = new Proofreader(linter);
beforeAll(() => engine.initialize(), 30000);
afterAll(() => linter.dispose());
it.each([...development.cases, ...regression.cases])(
  "quality control $id",
  async (c) => {
    const s = defaults();
    if ("dialect" in c && c.dialect === "UK") s.dialect = "UK";
    const issues = await engine.analyze(c.text, s, seedWords, 42);
    if (c.expectedBehavior === "no issue") {
      expect(issues).toEqual([]);
      return;
    }
    for (const e of c.expected) {
      const start = c.text.indexOf(e.target);
      expect(
        issues.some(
          (i) =>
            i.start < start + e.target.length &&
            i.end > start &&
            i.category === e.category,
        ),
      ).toBe(true);
    }
    if (c.expectedBehavior === "correction") {
      const chosen = issues
        .filter((i) => i.replacements.length)
        .sort((a, b) => b.start - a.start);
      let result = c.text,
        boundary = c.text.length;
      for (const i of chosen) {
        if (i.end <= boundary) {
          result = applyCorrection(result, i, i.replacements[0], 42);
          boundary = i.start;
        }
      }
      expect(c.acceptedCorrections).toContain(result);
    }
  },
);
it("requires the revision even when the original slice remains identical", () => {
  const i = {
    ...issue("test", "Spelling", 0, 3, "teh sample", ["the"], ""),
    revision: 7,
  };
  expect(() => applyCorrection("teh sample", i, "the", 8)).toThrow("revision");
  expect(() => applyCorrection("teh sample", i, "the")).toThrow("revision");
  expect(applyCorrection("teh sample", i, "the", 7)).toBe("the sample");
});
it("coordinates three edits in one validated transaction", async () => {
  const t = "These informations are useful.";
  const i = (await engine.analyze(t, defaults(), [], 13))[0];
  expect(i.edits).toHaveLength(3);
  expect(applyCorrection(t, i, i.replacements[0], 13)).toBe(
    "This information is useful.",
  );
  expect(() =>
    applyCorrection("These informations was useful.", i, i.replacements[0], 13),
  ).toThrow("stale");
});
it("merges one defect, marks conflicting alternatives, and keeps independent overlaps", () => {
  const a = issue("a", "Grammar", 0, 3, "bad word", ["good"], ""),
    b = issue("b", "Grammar", 0, 3, "bad word", ["better"], ""),
    c = issue("punctuation", "Punctuation", 2, 4, "bad word", [", "], "");
  const out = aggregateIssues([a, b, c]);
  expect(out).toHaveLength(2);
  expect(out[0].sources).toHaveLength(2);
  expect(out[0].alternativesConflict).toBe(true);
  expect(out.some((i) => i.rule === "punctuation")).toBe(true);
});
it("protects tokens without suppressing surrounding grammar, values or epistemic caution", () => {
  const t = "TNF-α are associated with toxicity at p = 0.08.";
  const policy = createScientificPolicy(t, [], []);
  const grammar = issue("agreement", "Grammar", 0, 9, t, ["TNF-α is"], "");
  expect(policy(grammar).issue?.replacements).toEqual(["TNF-α is"]);
  const harmful = issue(
    "rewrite",
    "Grammar",
    0,
    t.length,
    t,
    ["TNF-α causes toxicity at p = 0.05."],
    "",
  );
  expect(policy(harmful).issue?.replacements).toEqual([]);
});
it("accepts only curated or user-approved terms, while unknown misspellings remain detectable", async () => {
  const t = "We measured centifugation and supernatent.";
  const issues = await engine.analyze(t, defaults(), [], 3);
  expect(
    issues.find((i) => i.original === "centifugation")?.replacements[0],
  ).toBe("centrifugation");
  expect(
    issues.find((i) => i.original === "supernatent")?.replacements[0],
  ).toBe("supernatant");
  const unknown = await engine.analyze(
    "We measured xenofluxomics.",
    defaults(),
    [],
    4,
  );
  expect(unknown.some((i) => i.category === "Spelling")).toBe(true);
  const approved = await engine.analyze(
    "We measured xenofluxomics.",
    defaults(),
    ["xenofluxomics"],
    5,
  );
  expect(approved.some((i) => i.category === "Spelling")).toBe(false);
});
it("supports nonbreaking SI spaces and optional volume notation without changing numerical values", async () => {
  const s = defaults();
  s.siSpaceCharacter = "nbsp";
  s.unitNotation = "mL";
  s.overrides["Unit consistency"] = true;
  const a = await engine.analyze("37°C", s, [], 1);
  expect(a[0].replacements[0]).toBe("37\u00a0°C");
  const b = await engine.analyze("5 ml", s, [], 2);
  expect(b.find((i) => i.rule === "Unit consistency")?.replacements).toEqual([
    "5 mL",
  ]);
  expect(await engine.analyze("5 ml", defaults(), [], 3)).toEqual([]);
});

it.each([
  "The results of the assay show a trend.",
  "The effects of the compound are unknown.",
  "The effect, not the results, is unknown.",
  "The results and the conclusion are consistent.",
  "The effect that these compounds have is unknown.",
  "Each of the cultures was stained.",
  "Its importance is clear.",
])(
  "does not force agreement across an unsupported noun-phrase boundary: %s",
  async (text) => {
    expect(await engine.analyze(text, defaults(), seedWords, 1)).toEqual([]);
  },
);
it("checks a later sentence without crossing its clause boundary", async () => {
  const t =
    "The results show a trend. The effect of the compounds are unknown.";
  const a = await engine.analyze(t, defaults(), seedWords, 4);
  expect(a).toHaveLength(1);
  expect(a[0].original).toBe("are");
  expect(a[0].start).toBe(t.indexOf("are"));
  expect(applyCorrection(t, a[0], "is", 4)).toBe(
    t.replace("are unknown", "is unknown"),
  );
});
it("never offers unrelated everyday words for a recognized identifier case variant", async () => {
  const a = await engine.analyze(
    "The pfas concentration was measured.",
    defaults(),
    seedWords,
    1,
  );
  expect(a.some((i) => i.category === "Scientific")).toBe(true);
  expect(a.flatMap((i) => i.replacements)).not.toContain("peas");
  expect(
    a
      .filter((i) => i.original === "pfas")
      .every((i) => i.replacements.length === 0),
  ).toBe(true);
});
it("rejects a forged transaction that differs from its displayed replacement", () => {
  const t = "These informations are useful.";
  const bad = {
    ...issue("bad", "Grammar", 0, 22, t, ["This information is"], ""),
    edits: [{ start: 0, end: 5, original: "These", replacement: "Those" }],
    revision: 1,
  };
  expect(() => applyCorrection(t, bad, "This information is", 1)).toThrow(
    "does not match",
  );
});

it("keeps the held-out reference labels byte-for-byte frozen", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const frozen = JSON.parse(
    readFileSync(new URL("../benchmark/FROZEN.json", import.meta.url), "utf8"),
  );
  const bytes = readFileSync(
    new URL("../benchmark/corpus/held-out.json", import.meta.url),
  );
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    frozen.heldOutSha256,
  );
});

it("coordinates agreement and a governed preposition, and rejects the old revision", async () => {
  const text = "The controls depends of dose.";
  const first = await engine.analyze(text, defaults(), [], 51);
  const transaction = first.find((i) => i.rule === "Bounded agreement")!;
  expect(transaction.sources).toContain("Dependent preposition");
  expect(transaction.edits).toHaveLength(2);
  const corrected = applyCorrection(
    text,
    transaction,
    transaction.replacements[0],
    51,
  );
  expect(corrected).toBe("The controls depend on dose.");
  expect(() =>
    applyCorrection(text, transaction, transaction.replacements[0], 52),
  ).toThrow("revision");
  expect(await engine.analyze(corrected, defaults(), [], 52)).toEqual([]);
});

it("warns about incomplete mass-noun substitutions when coordinated correction is disabled", async () => {
  const s = defaults();
  s.overrides["Mass noun agreement"] = false;
  const issues = await engine.analyze(
    "These informations are useful.",
    s,
    [],
    1,
  );
  expect(issues.some((i) => i.original === "informations")).toBe(true);
  expect(
    issues
      .filter((i) => i.original === "informations")
      .every((i) => i.replacements.length === 0),
  ).toBe(true);
});
it("groups optional ml/mL consistency warnings with the same notation correction", async () => {
  const s = defaults();
  s.unitNotation = "mL";
  s.overrides["Unit consistency"] = true;
  const issues = await engine.analyze("We used 5 ml and 2 mL.", s, [], 1);
  expect(issues.filter((i) => i.rule === "Unit consistency")).toHaveLength(1);
});
