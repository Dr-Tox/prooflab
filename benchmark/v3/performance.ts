import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { writeFileSync } from "node:fs";
import { documentOf } from "./documents";
import os from "node:os";
const baseline = process.env.PERF_MODE === "baseline";
const { Proofreader } = await import(
  baseline
    ? "/tmp/prooflab-v3-baseline/src/proofreader.ts"
    : "../../src/proofreader"
);
const { defaults, seedWords } = await import("../../src/model");
const linter = new LocalLinter({ binary });
const e = new Proofreader(linter);
const start = performance.now();
await e.initialize();
const startupMs = performance.now() - start;
await e.analyze(documentOf(100), defaults(), seedWords, 0);
const rows = [];
for (const words of [1000, 5000, 10000])
  for (let trial = 0; trial < 3; trial++) {
    const text = documentOf(words, trial);
    for (const kind of ["changed", "unchanged"]) {
      const cpu = process.cpuUsage(),
        at = performance.now();
      const issues = await e.analyze(text, defaults(), seedWords, trial + 1);
      const usage = process.cpuUsage(cpu);
      rows.push({
        words,
        trial,
        kind,
        ms: performance.now() - at,
        cpuMs: (usage.user + usage.system) / 1000,
        issues: issues.length,
        memory: process.memoryUsage(),
      });
    }
  }
const report = {
  mode: baseline ? "baseline" : "v3",
  source: baseline ? "5181e41" : (process.env.SOURCE_COMMIT ?? "working-tree"),
  environment: {
    node: process.version,
    cpu: os.cpus()[0]?.model,
    harper: "3.0.0",
  },
  startupMs,
  statistics: e.statistics ?? null,
  rows,
};
writeFileSync(
  `benchmark/v3/reports/performance-${report.mode}.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    mode: report.mode,
    startupMs,
    rows: rows.map(({ words, trial, kind, ms, cpuMs, issues }) => ({
      words,
      trial,
      kind,
      ms,
      cpuMs,
      issues,
    })),
  }),
);
await linter.dispose();
