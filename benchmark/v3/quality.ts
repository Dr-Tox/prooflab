import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "../../src/proofreader";
import { defaults, seedWords, applyCorrection } from "../../src/model";
import { readFileSync, writeFileSync } from "node:fs";
const l = new LocalLinter({ binary }),
  e = new Proofreader(l, { diagnostics: true });
await e.initialize();
const rows = [];
for (const c of JSON.parse(readFileSync("benchmark/v3/quality.json", "utf8"))) {
  const issues = await e.analyze(c.text, defaults(), seedWords, 1);
  let first = c.text,
    boundary = c.text.length;
  for (const i of [...issues].sort((a, b) => b.start - a.start)) {
    if (i.replacements.length && i.end <= boundary) {
      first = applyCorrection(first, i, i.replacements[0], 1);
      boundary = i.start;
    }
  }
  rows.push({
    ...c,
    issues,
    first,
    complete: first === c.expected,
    detected:
      c.text !== c.expected
        ? issues.some((i) => i.category === "Grammar")
        : null,
    falsePositive: c.text === c.expected && issues.length > 0,
  });
}
writeFileSync(
  "benchmark/v3/reports/quality.json",
  JSON.stringify(
    {
      source: process.env.SOURCE_COMMIT ?? "working-tree",
      method:
        "Four original scientific paragraphs fixed after rule development; small engineering audit, not externally blinded. Review-only warnings never count as automatic correction.",
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify(
    rows.map((c) => ({
      id: c.id,
      detected: c.detected,
      complete: c.complete,
      falsePositive: c.falsePositive,
      issues: c.issues.map((i) => [i.rule, i.original, i.replacements]),
    })),
  ),
);
await l.dispose();

if (rows.some((c) => !c.complete || c.falsePositive))
  throw Error("V3 scientific paragraph regression; see the actual report.");
