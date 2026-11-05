import { temporalAnalysis } from "./linguistics/temporal";
import { it, expect, beforeAll, afterAll } from "vitest";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import { defaults, seedWords, applyCorrection } from "./model";
import { analyzeClauses } from "./linguistics/analyze";
import { tokenize, nounNumber } from "./linguistics/morphology";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const linter = new LocalLinter({ binary });
const engine = new Proofreader(linter, { diagnostics: true });
beforeAll(() => engine.initialize(), 30000);
afterAll(() => linter.dispose());
const pairs = [
  [
    "The researchers will analyzed the samples.",
    "The researchers will analyze the samples.",
  ],
  ["The reagents shows instability.", "The reagents show instability."],
  [
    "The concentrations of PFAS was measured.",
    "The concentrations of PFAS were measured.",
  ],
  [
    "The expression of these genes were increased.",
    "The expression of these genes was increased.",
  ],
  [
    "The samples that were collected was analyzed.",
    "The samples that were collected were analyzed.",
  ],
  [
    "The experiment was conduct yesterday.",
    "The experiment was conducted yesterday.",
  ],
  ["The samples were analyze by ELISA.", "The samples were analyzed by ELISA."],
  [
    "The researchers has identified three metabolites.",
    "The researchers have identified three metabolites.",
  ],
  [
    "The treatment may reduces inflammation.",
    "The treatment may reduce inflammation.",
  ],
  [
    "The experiment has been conduct twice.",
    "The experiment has been conducted twice.",
  ],
  [
    "The samples had been store at −80 °C.",
    "The samples had been stored at −80 °C.",
  ],
  ["The reagents has been analyze.", "The reagents have been analyzed."],
  ["The signals depends of time.", "The signals depend on time."],
  ["A series of tests were conducted.", "A series of tests was conducted."],
  [
    "Both the sample and the control was measured.",
    "Both the sample and the control were measured.",
  ],
  ["The mice has been treated.", "The mice have been treated."],
  [
    "We have been measure the response.",
    "We have been measuring the response.",
  ],
  [
    "The researchers were examine the cultures.",
    "The researchers were examining the cultures.",
  ],
];
it.each(pairs)(
  "offers a complete atomic correction: %s",
  async (text, expected) => {
    const issues = await engine.analyze(text, defaults(), seedWords, 7);
    expect(
      issues.some((i) =>
        i.replacements.some((r) => applyCorrection(text, i, r, 7) === expected),
      ),
    ).toBe(true);
    expect(issues.filter((i) => i.category === "Grammar")).toHaveLength(1);
    expect(await engine.analyze(expected, defaults(), seedWords, 8)).toEqual(
      [],
    );
  },
);
it.each([
  "The negative control was measured.",
  "The results as well as the effect are unknown.",
  "The results along with the effect are unknown.",
  "The treated control was analyzed.",
  "The quality control was completed.",
  "A series of experiments was conducted.",
  "A number of samples were excluded.",
  "The data are consistent with the hypothesis.",
  "The expression of inflammatory genes was increased.",
  "The cells had been treated before the assay began.",
  "Previous studies have reported similar findings.",
  "The samples were centrifuged at 3,000 × g.",
  "The temperature was 300 K and the potential was −3.2 mV.",
  "RNA-seq and CYP3A4 were evaluated.",
  "The experiment was complete yesterday.",
  "The experiment has been complete twice.",
  "The visitor was examine.",
  "The sample or the control was measured.",
  "The effect, not the results, is unknown.",
  "We have measured the response since yesterday.",
  "The results show a trend. Treatment increased expression. These findings may reflect adaptation.",
])("preserves valid or ambiguous construction: %s", async (text) => {
  expect(analyzeClauses(text, defaults())).toEqual([]);
});
it("keeps rule overrides independent inside coordinated transactions", () => {
  const s = defaults();
  s.overrides["Bounded agreement"] = false;
  const text = "The reagents has been analyze.";
  const [i] = analyzeClauses(text, s);
  expect(applyCorrection(text, i, i.replacements[0])).toBe(
    "The reagents has been analyzed.",
  );
  s.overrides["Verb forms"] = false;
  expect(analyzeClauses(text, s)).toEqual([]);
});
it("reviews dated perfect without rewriting scientific tense or certainty", () => {
  const [i] = temporalAnalysis(
    "We have measured the response yesterday.",
    defaults(),
  ).issues;
  expect(i.rule).toBe("Tense context review");
  expect(i.replacements).toEqual([]);
});
it("preserves UTF-16 offsets, combining marks, Greek identifiers and numbers", async () => {
  const text =
    "😀 The naïve observer reports results. The samples had been store at −80 °C with TNF-α.";
  const issues = await engine.analyze(text, defaults(), seedWords, 90);
  const i = issues.find((i) => i.original === "store")!;
  expect(text.slice(i.start, i.end)).toBe("store");
  expect(
    engine
      .getDiagnostics()
      ?.discardedLints.filter((i) =>
        ["invalid-span", "source-mismatch"].includes(i.reason),
      ),
  ).toEqual([]);
  expect(applyCorrection(text, i, i.replacements[0], 90)).toBe(
    text.replace("store", "stored"),
  );
  expect(() => applyCorrection(text, i, i.replacements[0], 91)).toThrow(
    "revision",
  );
  for (const t of tokenize("e\u0301 TNF-α −3.2 mV 10⁻³"))
    expect("e\u0301 TNF-α −3.2 mV 10⁻³".slice(t.start, t.end)).toBe(t.word);
});
it("infers productive noun morphology and irregular plurals without a subject-head noun list", () => {
  expect(nounNumber("microelectrodes")).toBe("plural");
  expect(nounNumber("vesicle")).toBe("singular");
  expect(nounNumber("nuclei")).toBe("plural");
  expect(nounNumber("ELISA")).toBeUndefined();
});
it("keeps v2 references frozen", () => {
  const frozen = JSON.parse(readFileSync("benchmark/v2/FROZEN.json", "utf8"));
  expect(
    createHash("sha256")
      .update(readFileSync("benchmark/v2/corpus.json"))
      .digest("hex"),
  ).toBe(frozen.sha256);
  expect(frozen.counts.agreement).toBeGreaterThanOrEqual(100);
  expect(frozen.counts.verb).toBeGreaterThanOrEqual(100);
  expect(frozen.counts.control).toBeGreaterThanOrEqual(100);
});

it("keeps independent lexical findings inside a modal span", async () => {
  const text = "The researchers will usefull collected the samples.";
  const findings = await engine.analyze(text, defaults(), seedWords, 1);
  expect(
    findings.some((i) => i.category === "Spelling" && i.original === "usefull"),
  ).toBe(true);
});

it("protects relative centrifugal force and sentence-final measurement punctuation narrowly", async () => {
  for (const text of [
    "The samples were centrifuged at 3,000 × g.",
    "The potential was −3.2 mV.",
    "The solution was held at 37 °C.",
  ]) {
    expect(await engine.analyze(text, defaults(), seedWords, 1)).toEqual([]);
  }
  expect(
    (
      await engine.analyze(
        "We recieved the samples after 30 min.",
        defaults(),
        seedWords,
        1,
      )
    ).some((i) => i.category === "Spelling"),
  ).toBe(true);
});

it("uses doubled-consonant forms from explicit irregular orthography", () => {
  const text = "The samples have control the response.";
  const [i] = analyzeClauses(text, defaults());
  expect(applyCorrection(text, i, i.replacements[0])).toBe(
    "The samples have controlled the response.",
  );
});

it.each([
  "Transcriptomics is informative.",
  "Proteomics is useful.",
  "The pharmacokinetics are nonlinear.",
  "NaCl is soluble.",
  "mRNA are present.",
])("abstains on ambiguous scientific grammatical number: %s", (text) => {
  expect(analyzeClauses(text, defaults())).toEqual([]);
});

it.each([
  "The measurements unexpectedly show a response.",
  "The results combined show a trend.",
  "The samples overall show a trend.",
])(
  "does not turn an unsupported modifier into the subject head: %s",
  (text) => {
    expect(analyzeClauses(text, defaults())).toEqual([]);
  },
);
