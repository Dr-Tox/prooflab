import { beforeAll, afterAll, it, expect } from "vitest";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import { defaults, seedWords, applyCorrection } from "./model";
const a = new LocalLinter({ binary }),
  b = new LocalLinter({ binary });
const cached = new Proofreader(a),
  fresh = new Proofreader(b, { cache: false });
beforeAll(async () => {
  await cached.initialize();
  await fresh.initialize();
}, 30000);
afterAll(async () => {
  await a.dispose();
  await b.dispose();
});
it.each([
  "microbead",
  "microbeads",
  "Microbeads",
  "microspheres",
  "liposomes",
  "cryovials",
])("protects approved scientific material vocabulary: %s", async (term) => {
  const issues = await cached.analyze(
    `We measured ${term}.`,
    defaults(),
    seedWords,
    1,
  );
  expect(
    issues.filter((i) => i.original.includes(term) && i.replacements.length),
  ).toEqual([]);
});
it("retains scientific spelling-error detection", async () => {
  expect(
    (
      await cached.analyze(
        "The microbads were stored.",
        defaults(),
        seedWords,
        1,
      )
    ).some((i) => i.category === "Spelling"),
  ).toBe(true);
});
it.each([
  [
    "The samples that the technician collected was analyzed.",
    "The samples that the technician collected were analyzed.",
  ],
  [
    "The fractions that we have collected was measured.",
    "The fractions that we have collected were measured.",
  ],
  [
    "The droplets oscillates near the electrode.",
    "The droplets oscillate near the electrode.",
  ],
  [
    "The cells fluoresces near the surface.",
    "The cells fluoresce near the surface.",
  ],
  [
    "The nuclei were isolate by centrifugation.",
    "The nuclei were isolated by centrifugation.",
  ],
])(
  "repairs structurally supported scientific grammar: %s",
  async (text, expected) => {
    const issues = await cached.analyze(text, defaults(), seedWords, 2);
    expect(
      issues.some((i) =>
        i.replacements.some((r) => applyCorrection(text, i, r, 2) === expected),
      ),
    ).toBe(true);
  },
);
it.each([
  "The samples that the technician collected were analyzed.",
  "The proteins that we have measured are stable.",
  "The effect that these compounds have is unknown.",
  "The samples and the controls were analyzed.",
  "The membrane proteins are stable.",
])("preserves correct and unresolved complex phrases: %s", async (text) => {
  expect(
    (await cached.analyze(text, defaults(), seedWords, 3)).filter(
      (i) => i.category === "Grammar",
    ),
  ).toEqual([]);
});
it("matches fresh full-document results through edits, Unicode, rules, dictionary and profile changes", async () => {
  const s = defaults();
  let rev = 10;
  for (const text of [
    "😀 The samples that we collected was analyzed.",
    "😀 The samples that we collected was analyzed.",
    "😀 The samples that we collected were analyzed.",
    "We have monitored the cultures since two hours.",
    "The potential was −3.2 mV.",
  ]) {
    const x = await cached.analyze(text, s, seedWords, rev),
      y = await fresh.analyze(text, s, seedWords, rev);
    expect(x).toEqual(y);
    for (const i of x) expect(text.slice(i.start, i.end)).toBe(i.original);
    rev++;
  }
  const text = "The microbads shows instability.";
  for (const change of [
    () => {},
    () => {
      s.profile = "Academic English";
    },
    () => {
      s.overrides["Bounded agreement"] = false;
    },
    () => {
      s.ignoredRules = ["SpellCheck"];
    },
  ]) {
    change();
    expect(await cached.analyze(text, s, seedWords, rev)).toEqual(
      await fresh.analyze(text, s, seedWords, rev),
    );
    rev++;
  }
  expect(
    await cached.analyze(text, s, [...seedWords, "microbads"], rev),
  ).toEqual(await fresh.analyze(text, s, [...seedWords, "microbads"], rev));
  expect(cached.statistics.cacheHits).toBeGreaterThan(0);
  expect(cached.statistics.configurationUpdates).toBeLessThan(
    cached.statistics.fullAnalyses,
  );
});
