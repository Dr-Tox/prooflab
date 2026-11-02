# Versioned quality benchmark

Version 1 freezes 50 development cases, 21 existing-behavior regression cases, and 31 held-out cases **before** linguistic implementation changes. `FROZEN.json` records the held-out SHA-256 and both relevant baseline commits. Baseline engine: `8a32c18`; the deployed/main reference was still `cf71cc7`. The first benchmark commit contains no linguistic changes. Corpus sentences are synthetic, originally authored for this task; no user documents or Microsoft Word outputs are included.

Each corpus record includes ID, original text, category, expected correction/warning/no-issue behavior, severity, target spans, accepted replacements and complete corrected sentences, forbidden outcomes, explanation, related group, and references to its actual engine result. Reports embed each reference case and the full actual issues, raw Harper lints, discarded reasons, and scores. `reports/baseline.json` is immutable baseline evidence; `reports/current.json` records the frozen implementation's evaluation. Held-out labels are not changed after freezing, and held-out failures must be reported rather than used for tuning.

Run from the repository root after `npm ci`:

```sh
npm run benchmark
npm run benchmark -- --label development-current --splits development,regression
```

`vite-node` is installed by the locked Vitest toolchain. Benchmark code runs locally in Node using the same real Harper WASM and production adapter; it does not fetch text services. `BENCHMARK_COMMIT` can explicitly identify a detached/worktree baseline. Run at the same code/lockfile version to reproduce scores; latency varies by host.

## Scoring and limits

- **Detection:** each annotated issue group receives at most one hit from findings overlapping its target. Multiple overlapping cards do not earn multiple hits. Warnings are detection successes for warning labels, never full-correction successes.
- **Classification:** a detected group must have the application's expected category. These are ProofLab's coarse Grammar/Spelling/Scientific/Style categories, not a complete syntactic taxonomy.
- **Replacement quality:** a group must actually offer an accepted replacement. A review warning and a partial noun-only fix do not earn this credit for a coordinated correction.
- **Complete correction:** the exact complete accepted sentence/paragraph must be reachable from actual offered actions (including atomic transactions). The oracle search is bounded to 1,024 nodes, four nonoverlapping actions, and five alternatives per card. This measures offered correction coverage, not an automatic correction success rate. The separate first-suggestion result applies the displayed first alternatives from right to left and is reported independently.
- **Meaning preservation proxy:** inspect all individual offered replacements for forbidden strings, changed numerical tokens, negation, and listed epistemic markers. This is a narrow automated safety audit, **not proof of full semantic preservation**. Human review of broader claims, agency and scientific meaning remains necessary.
- **False positives:** report the number of valid negative-control cases receiving any diagnostic. Extra unmatched diagnostics are also recorded; do not infer universal precision from this small hand-authored sample.
- **Duplicates:** exact category/span duplicates are counted separately; this metric underestimates semantic duplicates with different spans. Detection credit remains capped at one per reference group. Source IDs merged into one card are not extra detections.
- **Performance:** report initialization, per-case median/p95 latency, environment/lockfile, source hash, and small synthetic stress samples. These are in-process Node/WASM timings, not browser end-to-end latency, randomized performance trials, or a Word comparison. Cases are evaluated in a fixed order; warm-up/order/cache effects apply.

The development and regression cases are implementation tests. The held-out split is a small, predeclared, engineer-authored evaluation; its author also implemented the rules, so it is not an independently blinded linguistic study. No superiority over Microsoft Word or comprehensive proofreading is claimed. A larger independently annotated, domain-diverse corpus and a controlled Word comparison are future work.

## Evaluation rounds and leakage accounting

Round one was evaluated only after implementation commit `c7890d2`. The immutable `reports/held-out-round1-first-pass.json` retains that result: all 16 positive groups detected, 13/13 complete corrections offered, 12/13 first-suggestion complete corrections, and 1/15 negative controls falsely flagged. Manual inspection also found the unsafe `C. → Co` alternative in a positive paragraph, which the narrow automated meaning proxy did not catch.

Those findings were then promoted to **development safety regressions**. Token boundaries and scientific exponent handling were hardened in `a629ed8`. The original labels/hashes were never changed, but results for those same 31 cases in `current.json` are now **post-evaluation audits, not an untouched held-out score**.

Before hardening, commit `f9fbe1a` froze 20 new second-round cases and `FROZEN-ROUND2.json`. Run `npm run benchmark -- --label round2 --splits held-out-round2` to reproduce their evaluation. No subsequent linguistic tuning uses their outcomes. The misses and false positive are retained and documented in `BENCHMARK_RESULTS.md`. Neither round is independently authored/blinded; both remain small engineering benchmarks.
