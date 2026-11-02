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
