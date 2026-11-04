import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import os from "node:os";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "../../src/proofreader";
import {
  defaults,
  seedWords,
  applyCorrection,
  type Issue,
} from "../../src/model";
const bytes = readFileSync("benchmark/tense/corpus.json");
const frozen = JSON.parse(readFileSync("benchmark/tense/FROZEN.json", "utf8"));
if (createHash("sha256").update(bytes).digest("hex") !== frozen.sha256)
  throw Error("Frozen references changed");
const label = process.argv.includes("--baseline") ? "baseline" : "improved";
const path = `benchmark/tense/reports/${label}.json`;
const linter = new LocalLinter({ binary });
const engine = new Proofreader(linter, { diagnostics: true });
const at = performance.now();
await engine.initialize();
const setupMs = performance.now() - at;
const rows = [];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const invariant = (s: string) =>
  JSON.stringify({
    numbers: s.match(/[−-]?\d+(?:[.,]\d+)?/g) ?? [],
    epistemic: (
      s.match(
        /\b(?:may|might|could|suggests?|consistent with|associated with|not)\b/gi,
      ) ?? []
    ).map((x) => x.toLowerCase().replace(/^suggests$/, "suggest")),
    connectors: (
      s.match(
        /\b(?:since|before|after|during|until|when|once|yesterday|last week)\b/gi,
      ) ?? []
    ).map((x) => x.toLowerCase()),
  });
const discourseBytes = readFileSync("benchmark/tense/discourse.json");
const discourseFrozen = JSON.parse(
  readFileSync("benchmark/tense/FROZEN-DISCOURSE.json", "utf8"),
);
if (
  createHash("sha256").update(discourseBytes).digest("hex") !==
  discourseFrozen.sha256
)
  throw Error("Frozen discourse references changed");
for (const c of [
  ...JSON.parse(bytes.toString()),
  ...JSON.parse(discourseBytes.toString()),
]) {
  const start = performance.now();
  const issues = await engine.analyze(c.text, defaults(), seedWords, 1);
  const latencyMs = performance.now() - start;
  const match = c.target
    ? new RegExp(`\\b${escape(c.target)}\\b`, "i").exec(c.text)
    : null;
  const a = match?.index ?? 0,
    b = a + (c.target?.length ?? 0);
  const relevant = issues.filter(
    (i) => i.category === "Grammar" && i.start < b && i.end > a,
  );
  const sorted = [...issues].sort((a, b) => b.start - a.start);
  const outputs = new Set<string>();
  let nodes = 0;
  function visit(text: string, index: number, boundary: number, depth: number) {
    if (++nodes > 2048) return;
    outputs.add(text);
    if (depth >= 5) return;
    for (let n = index; n < sorted.length; n++) {
      const i = sorted[n];
      if (i.end > boundary) continue;
      for (const r of i.replacements.slice(0, 5)) {
        try {
          visit(applyCorrection(text, i, r, 1), n + 1, i.start, depth + 1);
        } catch {}
      }
    }
  }
  visit(c.text, 0, c.text.length, 0);
  let first = c.text,
    boundary = c.text.length;
  for (const i of sorted) {
    if (i.end > boundary || !i.replacements.length) continue;
    first = applyCorrection(first, i, i.replacements[0], 1);
    boundary = i.start;
  }
  const proposals = issues.flatMap((i) =>
    i.replacements.map((r, index) => ({
      rule: i.rule,
      original: i.original,
      replacement: r,
      first: index === 0,
      output: applyCorrection(c.text, i, r, 1),
      overlapsTarget: i.start < b && i.end > a,
      grammar: i.category === "Grammar",
    })),
  );
  rows.push({
    ...c,
    issues,
    raw: engine.getDiagnostics()?.rawLints,
    latencyMs,
    detected: c.behavior !== "no issue" && relevant.length > 0,
    complete:
      c.behavior === "correction"
        ? c.accepted.some((x: string) => outputs.has(x))
        : null,
    firstComplete:
      c.behavior === "correction" ? c.accepted.includes(first) : null,
    firstOutput: first,
    proposals: proposals.map((p) => ({
      ...p,
      referenceCorrect:
        c.behavior === "correction" ? c.accepted.includes(p.output) : null,
      meaningInvariantViolation: invariant(p.output) !== invariant(c.text),
      unwantedTemporalRewrite:
        c.behavior === "warning" && p.grammar && p.overlapsTarget,
    })),
    grammarFalsePositive:
      c.behavior === "no issue" && issues.some((i) => i.category === "Grammar"),
    anyFalsePositive: c.behavior === "no issue" && issues.length > 0,
    extraneous: issues.filter(
      (i) => i.category === "Grammar" && !relevant.includes(i),
    ).length,
    duplicateCards:
      issues.length -
      new Set(
        issues.map((i) => `${i.start}:${i.end}:${i.replacements.join("|")}`),
      ).size,
  });
}
function metrics(rs: any[]) {
  const positives = rs.filter((c) => c.behavior !== "no issue"),
    controls = rs.filter((c) => c.behavior === "no issue"),
    corrections = rs.filter((c) => c.behavior === "correction"),
    tp = positives.filter((c) => c.detected).length,
    fp = rs.reduce((n, c) => n + c.extraneous, 0),
    precision = tp + fp ? tp / (tp + fp) : null,
    recall = positives.length ? tp / positives.length : null;
  const proposals = rs.flatMap((c) => c.proposals),
    scored = proposals.filter((p) => p.referenceCorrect !== null),
    first = scored.filter((p) => p.first),
    latency = rs.map((c) => c.latencyMs).sort((a, b) => a - b);
  return {
    cases: rs.length,
    positives: positives.length,
    controls: controls.length,
    detected: tp,
    extraneousGrammarCards: fp,
    precision,
    recall,
    f1:
      precision !== null && recall !== null && precision + recall
        ? (2 * precision * recall) / (precision + recall)
        : null,
    correctionCases: corrections.length,
    completeCorrections: corrections.filter((c) => c.complete).length,
    firstCompleteCorrections: corrections.filter((c) => c.firstComplete).length,
    referenceCorrectProposals: scored.filter((p) => p.referenceCorrect).length,
    scoredProposals: scored.length,
    firstCorrectProposals: first.filter((p) => p.referenceCorrect).length,
    scoredFirstProposals: first.length,
    grammarFalsePositives: controls.filter((c) => c.grammarFalsePositive)
      .length,
    allFalsePositives: controls.filter((c) => c.anyFalsePositive).length,
    meaningInvariantViolations: proposals.filter(
      (p) => p.meaningInvariantViolation,
    ).length,
    unwantedTemporalRewrites: proposals.filter((p) => p.unwantedTemporalRewrite)
      .length,
    proposals: proposals.length,
    duplicates: rs.reduce((n, c) => n + c.duplicateCards, 0),
    families: new Set(rs.map((c) => c.family)).size,
    latencyMedianMs: latency[Math.floor(latency.length / 2)],
    latencyP95Ms: latency[Math.floor(latency.length * 0.95)],
  };
}
const summaries = Object.fromEntries(
  [
    "all",
    "temporal",
    "discourse",
    "aspect",
    "form",
    "control",
    "development",
    "regression",
    "held-out",
    "held-out-temporal",
    "held-out-control",
  ].map((k) => [
    k,
    metrics(
      rows.filter(
        (c) =>
          k === "all" ||
          k === c.category ||
          k === c.split ||
          k === `${c.split}-${c.category}`,
      ),
    ),
  ]),
);
writeFileSync(
  path,
  JSON.stringify(
    {
      label,
      sourceCommit: process.env.SOURCE_COMMIT ?? "working-tree",
      corpusSha: frozen.sha256,
      discourseSha: discourseFrozen.sha256,
      environment: {
        node: process.version,
        platform: process.platform,
        cpu: os.cpus()[0]?.model,
        harper: "3.0.0",
      },
      setupMs,
      memory: process.memoryUsage(),
      metrics: summaries,
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ label, metrics: summaries }, null, 2));
await linter.dispose();
