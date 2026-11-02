import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

import os from "node:os";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "../src/proofreader";
import { defaults, seedWords, applyCorrection, type Issue } from "../src/model";
const args = process.argv.slice(2);
const option = (key: string, fallback: string) => {
  const at = args.indexOf(key);
  return at < 0 ? fallback : args[at + 1];
};
const label = option("--label", "current"),
  output = option("--output", `benchmark/reports/${label}.json`);
const sha = (s: string | Buffer) =>
  createHash("sha256").update(s).digest("hex");
const linter = new LocalLinter({ binary });
const engine = new Proofreader(linter, { diagnostics: true });
const started = performance.now();
await engine.initialize();
const setupMs = performance.now() - started;
const cases: any[] = [];
const hashes: Record<string, string> = {};
const splits = option("--splits", "development,regression,held-out").split(",");
for (const split of splits) {
  const path = `benchmark/corpus/${split}.json`,
    bytes = readFileSync(path);
  hashes[split] = sha(bytes);
  for (const c of JSON.parse(bytes.toString()).cases)
    cases.push({ ...c, split });
}
function actionOutput(text: string, i: Issue, r: string) {
  return applyCorrection(text, i, r, i.revision);
}
function metrics(c: any, issues: Issue[]) {
  const expected = c.expected;
  const matches = expected.map((e: any) => {
    const start = c.text.indexOf(e.target),
      end = start + e.target.length;
    if (start < 0) throw Error(`Missing target ${c.id}`);
    return issues.filter((i) => i.start < end && i.end > start);
  });
  const detected = matches.filter((m: Issue[]) => m.length).length;
  const classified = matches.filter((m: Issue[], idx: number) =>
    m.some((i) => i.category === expected[idx].category),
  ).length;
  const suggestionQuality = matches.filter((m: Issue[], idx: number) =>
    m.some((i) =>
      i.replacements.some((r) =>
        expected[idx].acceptedReplacements.includes(r),
      ),
    ),
  ).length;
  const outputs = new Set<string>();
  let paths = 0;
  // Offered-correction coverage (an oracle over actual suggestions, not an automatic fix score).
  function enumerate(
    index: number,
    text: string,
    boundary: number,
    edits: number,
  ) {
    if (++paths > 1024) return;
    outputs.add(text);
    if (edits >= 4) return;
    for (let n = index; n < issues.length; n++) {
      const i = issues[n];
      if (i.end > boundary) continue;
      for (const r of i.replacements.slice(0, 5)) {
        try {
          enumerate(n + 1, actionOutput(text, i, r), i.start, edits + 1);
        } catch {}
      }
    }
  }
  const sorted = [...issues].sort((a, b) => b.start - a.start);
  issues = sorted;
  enumerate(0, c.text, c.text.length, 0);
  const offeredComplete =
    c.acceptedCorrections.length > 0 &&
    c.acceptedCorrections.some((s: string) => outputs.has(s));
  const edits = issues.filter((i) => i.replacements.length);
  let first = c.text,
    boundary = c.text.length;
  for (const i of edits) {
    if (i.end > boundary) continue;
    try {
      first = actionOutput(first, i, i.replacements[0]);
      boundary = i.start;
    } catch {}
  }
  const numbers = (s: string) => s.match(/[−-]?\d+(?:[.,]\d+)?/g) ?? [];
  const hedge = (s: string) =>
    s
      .match(
        /\b(?:may|might|suggests?|consistent with|associated with|not)\b/gi,
      )
      ?.map((s) => s.toLowerCase().replace(/^suggests$/, "suggest")) ?? [];
  const forbidden = (s: string) =>
    c.forbiddenCorrections.some(
      (f: string) => !c.text.includes(f) && s.includes(f),
    );
  const harmful = edits
    .flatMap((i) => i.replacements.map((r) => actionOutput(c.text, i, r)))
    .filter(
      (s) =>
        forbidden(s) ||
        JSON.stringify(numbers(s)) !== JSON.stringify(numbers(c.text)) ||
        JSON.stringify(hedge(s)) !== JSON.stringify(hedge(c.text)),
    );
  const duplicateCount =
    issues.length -
    new Set(issues.map((i) => `${i.category}:${i.start}:${i.end}`)).size;
  const unmatched = issues.filter(
    (i) =>
      !expected.some((e: any) => {
        const a = c.text.indexOf(e.target);
        return i.start < a + e.target.length && i.end > a;
      }),
  ).length;
  return {
    expectedCount: expected.length,
    detected,
    classified,
    suggestionQuality,
    offeredComplete,
    firstSuggestionComplete: c.acceptedCorrections.includes(first),
    firstSuggestionOutput: first,
    negativeFalsePositive:
      c.expectedBehavior === "no issue" && issues.length > 0,
    unmatchedDiagnostics: unmatched,
    duplicateCount,
    harmfulSuggestionCount: harmful.length,
    meaningPreservationProxy: harmful.length === 0,
  };
}
for (const c of cases) {
  const settings = defaults();
  if (c.dialect) settings.dialect = c.dialect;
  const t = performance.now();
  const issues = await engine.analyze(c.text, settings, seedWords);
  const ms = performance.now() - t;
  const diagnostics = engine.getDiagnostics();
  c.actualEngineResult = {
    issues,
    rawLints: diagnostics?.rawLints,
    discardedLints: diagnostics?.discardedLints,
    latencyMs: ms,
  };
  c.metrics = metrics(c, issues);
}
const summaries = Object.fromEntries(
  splits.map((split) => {
    const rows = cases.filter((c) => c.split === split),
      sum = (key: string) =>
        rows.reduce((a, c) => a + Number(c.metrics[key]), 0),
      times = rows
        .map((c) => c.actualEngineResult.latencyMs)
        .sort((a, b) => a - b);
    return [
      split,
      {
        cases: rows.length,
        positiveGroups: sum("expectedCount"),
        detected: sum("detected"),
        classified: sum("classified"),
        acceptedReplacementGroups: sum("suggestionQuality"),
        correctionCases: rows.filter((c) => c.expectedBehavior === "correction")
          .length,
        offeredCompleteCorrections: sum("offeredComplete"),
        firstSuggestionCompleteCorrections: sum("firstSuggestionComplete"),
        negativeCases: rows.filter((c) => c.expectedBehavior === "no issue")
          .length,
        negativeFalsePositiveCases: sum("negativeFalsePositive"),
        unmatchedDiagnostics: sum("unmatchedDiagnostics"),
        duplicateDiagnostics: sum("duplicateCount"),
        harmfulSuggestionsProxy: sum("harmfulSuggestionCount"),
        medianMs: times[Math.floor(times.length / 2)],
        p95Ms: times[Math.floor(times.length * 0.95)],
      },
    ];
  }),
);
const stress = [];
if (label !== "baseline")
  for (const repeats of [10, 100]) {
    const text =
      "The samples were analyzed after centrifugation at 37 °C. ".repeat(
        repeats,
      );
    const samples = [];
    for (let n = 0; n < 3; n++) {
      const start = performance.now();
      await engine.analyze(text, defaults(), seedWords);
      samples.push(performance.now() - start);
    }
    stress.push({
      characters: text.length,
      runs: 3,
      medianMs: samples.sort((a, b) => a - b)[1],
    });
  }
const implementationSha256 = sha(
  readdirSync("src")
    .filter((n) => /\.tsx?$/.test(n))
    .sort()
    .map((n) => n + "\n" + readFileSync("src/" + n, "utf8"))
    .join("\n"),
);
const report = {
  scoringVersion: 1,
  implementationSha256,
  stress,
  corpusVersion: 1,
  label,
  environment: {
    commit:
      process.env.BENCHMARK_COMMIT ??
      (() => {
        const head = readFileSync(".git/HEAD", "utf8").trim();
        return head.startsWith("ref: ")
          ? readFileSync(".git/" + head.slice(5), "utf8").trim()
          : head;
      })(),
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0]?.model,
    harper: JSON.parse(
      readFileSync("node_modules/harper.js/package.json", "utf8"),
    ).version,
    lockSha256: sha(readFileSync("package-lock.json")),
    setupMs,
  },
  corpusHashes: hashes,
  summary: summaries,
  cases,
};
mkdirSync(output.substring(0, output.lastIndexOf("/")), { recursive: true });
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ label, output, summary: summaries }, null, 2));
await linter.dispose();
