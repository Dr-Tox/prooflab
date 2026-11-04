# ProofLab benchmark results

The complete reproducible corpus, full actual outputs, source/environment hashes, and methodology are in [benchmark/](benchmark/README.md). Harper is pinned to **3.0.0**, Apache-2.0. Its shipped APIs and actual UTF-16/`get_problem_text()` behavior were checked before changes. Baseline implementation: **8a32c18**, while deployed/main was **cf71cc7**. Baseline was recorded before linguistic changes in commit **900030f**. Rule implementation was frozen at **c7890d2** for the first held-out evaluation.

## Measured linguistic outcomes

| Dataset / metric                                                                        |       Baseline | Improved implementation |
| --------------------------------------------------------------------------------------- | -------------: | ----------------------: |
| Development: issue groups detected / classified                                         | 7 / 25; 6 / 25 |        25 / 25; 25 / 25 |
| Development: complete accepted corrections offered                                      |         2 / 20 |                 20 / 20 |
| Development: negative-control cases falsely flagged                                     |         8 / 26 |                  0 / 26 |
| Development: exact-span duplicate cards                                                 |              2 |                       0 |
| Regression: complete corrections offered                                                |        11 / 11 |                 11 / 11 |
| Regression: negative-control cases falsely flagged                                      |         0 / 10 |                  0 / 10 |
| Regression: exact-span duplicate cards                                                  |              2 |                       0 |
| First held-out round, **before** inspecting failures: detection / classification        | 4 / 16; 3 / 16 |        16 / 16; 16 / 16 |
| First held-out round, before inspecting failures: complete corrections offered          |         2 / 13 |                 13 / 13 |
| First held-out round, before inspecting failures: first-suggestion complete corrections |         2 / 13 |                 12 / 13 |
| First held-out round, before inspecting failures: negative false positives              |         7 / 15 |                  1 / 15 |
| Fresh second held-out round: detection / classification                                 |   Not measured |            8 / 9; 8 / 9 |
| Fresh second held-out round: complete offered / first-suggestion corrections            |   Not measured |            7 / 9; 7 / 9 |
| Fresh second held-out round: negative false positives                                   |   Not measured |                  1 / 11 |

A partial correction is never a full-sentence success. Multiple diagnostics on one target never earn multiple detections. “Offered” is a bounded oracle over actual alternatives, not a claim of automatic correction. Coarse classification uses the application's categories. See the benchmark README for search bounds and exact definitions.

## What failed and what remains

The first held-out round exposed `mol` after `2 × 10⁻³` as a false positive and an unsafe `C. → Co` suggestion at a Celsius sentence boundary. Their original outputs are preserved. A subsequent, general protected-token-boundary and exponent fix addresses both, and the original 31 cases now pass a post-evaluation audit. **That later perfect audit is not presented as an untouched held-out result.** Original held-out labels and their hash remain unchanged.

A fresh second-round set was frozen before those safety fixes. It still exposes limitations, deliberately left without score-driven tuning:

- **V05:** `The signals depends of time.` produces separate agreement/preposition findings. It can be corrected through successive fresh analyses, but the static nonoverlapping offered-action metric does not credit the complete correction. A partial output does not pass.
- **V09:** `The reagents shows instability.` is missed because the bounded subject-head lexicon does not recognize that noun. The implementation does not pretend to have a general syntactic parser.
- **V20:** `−3.2 mV` receives an inappropriate spelling warning because the selected measurement-symbol coverage lacks that prefix combination. This is a remaining scientific-notation false positive; authors must review suggestions.

The numerical/hedge/forbidden-string safety proxy reports no violations for the final recorded corpora, but it did **not** detect every scientifically harmful lexical proposal in the first pass. The `C. → Co` case and remaining mV warning demonstrate why this proxy cannot establish full meaning preservation. No chemical identity, causal interpretation, agency, or scientific correctness is certified.

## Performance and reproducibility

Recorded environment: Node **v24.19.0**, Linux x64, AMD EPYC 9V45; exact lockfile hash is stored in every report. These are single-process Node/real-WASM measurements, not browser rendering/network timings or a randomized speed comparison. Across these short cases, typical per-case medians are around **4–6 ms**. A synthetic 5,700-character stress sample took about **35 ms** median over three runs. Initialization is reported separately. Cache/JIT/order/host effects apply; do not infer a speed improvement from small timing differences.

Run `npm test`, `npm run build`, `npm run test:e2e`, and `npm run benchmark`. Production browser tests also run at `/prooflab/`, with privacy/network/offline coverage, coordinated-edit formatting/Undo, and real development diagnostics. References include sentences, paragraphs, positive/negative variants, Greek, emoji, combining marks, Unicode minus and superscripts. Frozen held-out labels are hash-checked.

This is substantial measured improvement on a small engineer-authored corpus, **not evidence of superiority over Microsoft Word**. No controlled Word comparison was performed. A larger independently annotated corpus, broader SI prefix coverage, deeper parsing, browser diversity, and human semantic review remain necessary before such a claim.

## V2: agreement and auxiliary analysis (2026-11-04)

The v2 baseline is the prior benchmark branch **0c3b269**, not the older deployed main. Final engine **31d2e94** replaces the subject-head noun whitelist with productive noun morphology and shallow clause analysis; Harper 3.0.0 remains unchanged. See [v2 methodology and raw results](benchmark/v2/README.md), including frozen hashes, reference errata and restrictions on generalization. All historical results above remain preserved.

| Main challenge metric                                                  | Baseline | Final audit |
| ---------------------------------------------------------------------- | -------: | ----------: |
| Agreement detection recall (105 cases)                                 |    14.3% |      100.0% |
| Agreement precision (105 cases)                                        |   100.0% |      100.0% |
| Agreement F1 (105 cases)                                               |    25.0% |      100.0% |
| Agreement complete/first-choice sentence correction (105 cases)        |    14.3% |      100.0% |
| Verb detection recall                                                  |    26.2% |      100.0% |
| Verb precision                                                         |    77.1% |       99.0% |
| Verb F1                                                                |    39.1% |       99.5% |
| Verb complete correction                                               |    17.3% |       99.0% |
| Verb first-choice complete correction                                  |    17.3% |       99.0% |
| Verb replacement quality (aligned alternatives only)                   |    64.7% |      100.0% |
| Verb first-suggestion correctness (aligned cards)                      |    64.7% |      100.0% |
| All-category false-positive controls (125 including 2 errata controls) |     3.2% |        0.8% |
| Exact duplicate cards                                                  |        0 |           0 |

The final challenge audit detects/classifies **208/208** positive groups. Complete outcomes are **202/203** correction cases (105/105 agreement; 97/98 verb); five dated-perfect cases are warning-only. One of 125 valid controls still receives a Harper Grammar warning on “The experiment was complete yesterday.” The dedicated 123-control set has zero false positives. Final reserved-family audits detect 25/25 agreement and 25/25 verb cases, but these are **post-evaluation audits**, not a new untouched held-out claim. The preserved first evaluation had verb first-choice completeness 91/98 under its original reference labels; consult the reports and errata for exact denominators.

### Fresh paragraph audit: stronger remaining limits

| Metric (12 error paragraphs, 18 controls)  | Baseline | V2 first evaluation |
| ------------------------------------------ | -------: | ------------------: |
| Detection precision                        |    50.0% |              100.0% |
| Detection recall                           |     8.3% |               75.0% |
| F1                                         |    14.3% |               85.7% |
| Complete paragraph correction offered      |     8.3% |               75.0% |
| First-choice complete paragraph correction |     8.3% |               66.7% |
| Aligned replacement quality                |     6.7% |               69.2% |
| Aligned first-suggestion correctness       |    14.3% |               81.8% |
| All-category control false positives       |    16.7% |                5.6% |

This set was frozen after engine 19b93c7 and **not tuned to its failures**. Its first output is preserved; the later code-review safeguards for ambiguous scientific noun number, unsupported modifiers and inline formatting do not change these scores. Detection rises from **1/12 to 9/12**; exact offered paragraph corrections from **1/12 to 9/12**; first-choice completion is only **8/12**. The higher score on lexical templates must not obscure this result. Failures remain:

- Object relatives: “The samples that the technician collected was analyzed” is missed.
- Unknown verb paradigms: “droplets oscillates” and “nuclei were isolate” are missed.
- Coordinated correction outside supported grammar: “does not agrees the result” leaves the missing “with”; the corrected reference now counts it incomplete.
- Scientific false positive: **microbeads → microbe’s / microbes** remains harmful and can corrupt a correct scientific term. It appears in both a positive paragraph and its correct control. There is no automatic replacement or accept-all, but users must reject these alternatives or add the term locally. The numeric/hedge harm proxy misses this semantic problem; its zero value is not a safety certification.

### Scientific safety and regression

The supplied safeguards retain centrifugation, supernatant, min, °C, K, micro symbols, exponents, Unicode minus, compound doses, PFAS, TNF-α/IL-1β, RNA-seq and CYP3A4. V2 fixes the previously recorded mV warning using finite SI-prefix recognition and protects relative centrifugal-force notation. Protected tokens do not suppress surrounding agreement corrections. Hedging and numerical values remain unchanged in the evaluated transactions. Unknown technical vocabulary still requires curation; scientific safety is improved but incomplete.

The original development and regression audit remains 20/20 and 11/11 complete corrections, with no negative-control false positives. The original 31 held-out cases also pass as a clearly labeled historical post-evaluation audit. Their initial outputs and old second-round failures have not been rewritten.

### Environment and checks

Node v24.19.0, Linux, AMD EPYC 9V45 96-Core Processor; Harper 3.0.0, Vite 7.3.7, TypeScript 5.9.3, Vitest 3.2.7, Playwright 1.64.1. Dependencies were not upgraded. Main-challenge latency median: **3.92 → 3.81 ms**; p95 **19.65 → 5.89 ms**. Setup **812 → 599 ms**. End-of-run harness RSS **559.3 → 524.3 MiB**, heap used **25.2 → 26.1 MiB**. These noisy whole-harness samples include WASM/report retention, not browser peaks or evidence of a memory optimization.

`npm test`: **180 passed**. Production build, original benchmark, v2 benchmark and formatting checks pass. **15/15 browser scenarios passed locally at `/` and `/prooflab/`**, including live edits, individual accept/dismiss, coordinated edits/Undo, rapid revisions, long paragraphs, formatting, Unicode, mobile, offline and network checks; existing appearance, local-only processing, optional persistence and static hosting remain intact.

### Modified implementation

`src/linguistics/{morphology,subjects,verbs,analyze}.ts` implements the new layers; `grammar.ts` retains other existing rules and settings IDs. `model.ts` enables the two new configurable rule families. `editorTransactions.ts` gives edit starts forward affinity at inline-node boundaries so a whole bold/italic word retains its wrapper. `policy.ts` merges verb duplicates and conflicting modal constructions; `measurements.ts` and `vocabulary.ts` add narrow scientific protections. Unit/browser tests, frozen v2 corpora/scorers/reports, CI measurement, and architecture/rule/vocabulary documentation accompany the changes. No model, runtime dependency, analytics or remote processing was added.
