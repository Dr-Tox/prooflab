import { beforeAll, afterAll, it, expect } from "vitest";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import { defaults, seedWords, applyCorrection } from "./model";
import { temporalAnalysis } from "./linguistics/temporal";
import { verbChain } from "./linguistics/verbChain";
import { tokenize } from "./linguistics/morphology";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
const linter = new LocalLinter({ binary }),
  engine = new Proofreader(linter);
beforeAll(() => engine.initialize(), 30000);
afterAll(() => linter.dispose());
it.each([
  ["We measured the response.", "past", false, false, false],
  ["We measure the response.", "present", false, false, false],
  ["We have measured the response.", "present", true, false, false],
  ["We had measured the response.", "past", true, false, false],
  ["We are measuring the response.", "present", false, true, false],
  ["We have been measuring the response.", "present", true, true, false],
  ["We had been measuring the response.", "past", true, true, false],
  ["They were measured.", "past", false, false, true],
  ["They have been measured.", "present", true, false, true],
  ["They will have been measured.", "future", true, false, true],
  ["They might have been measured.", "modal", true, false, true],
  ["We wrote the protocol.", "past", false, false, false],
])(
  "describes observed tense and aspect independently of agreement: %s",
  (text, tense, perfect, progressive, passive) => {
    const c = verbChain(tokenize(text as string), 1)!;
    expect(c).toMatchObject({ tense, perfect, progressive, passive });
  },
);
it.each([
  ["Yesterday, we have measured the response.", "Tense context review"],
  [
    "We have measured the response by microscopy yesterday.",
    "Tense context review",
  ],
  ["We have been measuring the response yesterday.", "Tense context review"],
  ["The samples have been measured last week.", "Tense context review"],
  ["Yesterday, we will measure the response.", "Tense context review"],
  [
    "When the samples will be measured, we will record the response.",
    "Temporal clause review",
  ],
  [
    "Before the samples will be analyzed, we will prepare the reagents.",
    "Temporal clause review",
  ],
  [
    "We still monitor the cultures continuously since 2019.",
    "Temporal interval review",
  ],
  [
    "We have monitored the cultures since two hours.",
    "Temporal interval review",
  ],
  ["The extract is consisting of three fractions.", "Aspect context review"],
  ["The samples are been analyzed.", "Temporal auxiliary review"],
  ["We have being monitoring the cultures.", "Temporal auxiliary review"],
  [
    "We analyzed the cultures yesterday. During that experiment, we have observed cell division.",
    "Temporal reference review",
  ],
])(
  "reviews temporal evidence without rewriting chronology: %s",
  async (text, rule) => {
    const findings = await engine.analyze(text, defaults(), seedWords, 29);
    const i = findings.find((i) => i.rule === rule)!;
    expect(i).toBeDefined();
    expect(i.replacements).toEqual([]);
    expect(i.confidence).toBe("low");
    expect(text.slice(i.start, i.end)).toBe(i.original);
    if (
      rule === "Temporal interval review" ||
      rule === "Temporal auxiliary review"
    )
      expect(findings.filter((i) => i.replacements.length)).toEqual([]);
  },
);
it.each([
  "We have monitored the cultures since yesterday.",
  "We have monitored the cultures since two hours ago.",
  "We have monitored the cultures since two hours before the assay.",
  "We have monitored the cultures during the last week.",
  "We have monitored the cultures over the last week.",
  "We have previously monitored the cultures.",
  "Previously, we monitored the cultures.",
  "We have analyzed the samples collected yesterday.",
  "We have analyzed the samples that were collected yesterday.",
  "We have analyzed yesterday's samples.",
  "We may have measured the response yesterday.",
  "We have repeated the word “yesterday” in the protocol.",
  "We do not know when the samples will arrive.",
  "When will the samples be measured?",
  "We are seeing a transient response during treatment.",
  "The cells are having an unexpected response.",
  "We are thinking about an alternative mechanism.",
  "The investigator is understanding the mechanism better each day.",
  "The samples were stored before they were analyzed.",
  "The samples were stored yesterday. The response has increased since then.",
  "The samples were stored yesterday. We have now analyzed them.",
  "The samples were stored yesterday.\n\nAt that time, we have analyzed them.",
  "Methods\nThe samples were stored yesterday.\nDiscussion\nAt that time, we have analyzed them.",
  "Methods\nThe samples were centrifuged at 3,000 × g for 30 min.\nResults\nTreatment increased IL-6 expression.\nDiscussion\nThese findings suggest that exposure may affect metabolism. PFAS are persistent environmental contaminants.",
  "The temperature was 37 °C. The potential was −3.2 mV. Previous studies have reported similar findings.",
])("preserves valid or unresolved temporal context: %s", async (text) => {
  expect(temporalAnalysis(text, defaults()).issues).toEqual([]);
  expect(
    (await engine.analyze(text, defaults(), seedWords, 1)).filter(
      (i) => i.category === "Grammar",
    ),
  ).toEqual([]);
});
it("separates finite-form corrections from chronology review and keeps atomic Undo inputs exact", async () => {
  const text =
    "😀 The samples had been store at −80 °C before the assay began.";
  const findings = await engine.analyze(text, defaults(), seedWords, 30);
  const i = findings.find((i) => i.original === "store")!;
  expect(applyCorrection(text, i, i.replacements[0], 30)).toBe(
    text.replace("store", "stored"),
  );
  expect(() => applyCorrection(text, i, i.replacements[0], 31)).toThrow(
    "revision",
  );
});
it("offers no scientific tense policy merely because a section label changes", () => {
  for (const profile of [
    "General English",
    "Academic English",
    "Scientific Writing",
  ] as const) {
    const s = defaults();
    s.profile = profile;
    expect(
      temporalAnalysis(
        "Methods\nWe measure the response.\nResults\nThe response increased.\nDiscussion\nThe response may reflect adaptation.",
        s,
      ).issues,
    ).toEqual([]);
  }
});
it("supports independent settings and ignores for temporal rule families", () => {
  const text = "Yesterday, we have measured the response.";
  const s = defaults();
  s.overrides["Tense context review"] = false;
  expect(temporalAnalysis(text, s).issues).toEqual([]);
  s.overrides["Tense context review"] = true;
  s.ignoredRules = ["Tense context review"];
  expect(temporalAnalysis(text, s).issues).toEqual([]);
});
it("does not invent antecedent times without an explicit backward reference", () => {
  const result = temporalAnalysis(
    "We measured the response yesterday. We have analyzed the data. We may report the findings tomorrow.",
    defaults(),
  );
  expect(result.issues).toEqual([]);
  expect(result.frames.filter((f) => f.event)).toHaveLength(3);
});
it("hash-verifies both independently versioned reference sets", () => {
  for (const [file, frozen] of [
    ["corpus.json", "FROZEN.json"],
    ["discourse.json", "FROZEN-DISCOURSE.json"],
  ])
    expect(
      createHash("sha256")
        .update(readFileSync(`benchmark/tense/${file}`))
        .digest("hex"),
    ).toBe(
      JSON.parse(readFileSync(`benchmark/tense/${frozen}`, "utf8")).sha256,
    );
});

it("does not choose completed versus ongoing activity for a missing perfect-progressive auxiliary", async () => {
  for (const text of [
    "We have monitoring the cultures.",
    "The samples have undergoing analysis.",
  ]) {
    const issues = await engine.analyze(text, defaults(), seedWords, 1);
    expect(issues.some((i) => i.rule === "Temporal auxiliary review")).toBe(
      true,
    );
    expect(issues.filter((i) => i.replacements.length)).toEqual([]);
  }
});

it.each([
  "We have monitoring data.",
  "The laboratory has measuring equipment.",
  "We have binding assays.",
])(
  "distinguishes lexical possession from perfect/progressive aspect: %s",
  async (text) => {
    expect(temporalAnalysis(text, defaults()).issues).toEqual([]);
    expect(
      (await engine.analyze(text, defaults(), seedWords, 1)).filter(
        (i) => i.category === "Grammar",
      ),
    ).toEqual([]);
  },
);

it("does not repair a malformed stative chain by inventing an ongoing action", async () => {
  const issues = await engine.analyze(
    "We are know the mechanism.",
    defaults(),
    seedWords,
    1,
  );
  expect(issues.some((i) => i.rule === "Temporal auxiliary review")).toBe(true);
  expect(issues.filter((i) => i.replacements.length)).toEqual([]);
});

it.each([
  "We have repeated the word 'yesterday' in the protocol.",
  "We have repeated the word ‘yesterday’ in the protocol.",
])(
  "recognizes quotation without treating possessive apostrophes as time anchors: %s",
  (text) => {
    expect(temporalAnalysis(text, defaults()).issues).toEqual([]);
  },
);
