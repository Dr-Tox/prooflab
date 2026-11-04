# Dedicated tense, aspect and temporal-context benchmark

Tense/aspect is an independent development objective, with its own corpus, analysis modules, CI regression check and results. Auxiliary-form accuracy is **not** evidence of temporal consistency.

```sh
npm run benchmark:tense
npm run benchmark:tense -- --check
# Development-only evaluation (does not overwrite the final/first evaluation):
TENSE_SPLITS=development,regression npm run benchmark:tense
```

## Freeze and provenance

The baseline is PR #5 at **d304819**, with actual Harper **3.0.0** WASM and ProofLab's production adapter, settings, scientific policy and aggregator. No package versions were changed. Both raw Harper lints and final ProofLab issues are retained per case. This distinguishes native limitations, native false positives, and adapter/custom-rule behavior.

`8fe54d8` freezes `corpus.json` before temporal implementation: 125 positive cases and 170 controls. `b55c82b` separately freezes `discourse.json`, adding ten cross-sentence cases and ten controls before production temporal integration and before their first engine evaluation. The discourse architecture had already been considered; this is disclosed rather than described as externally blinded. Both manifests hash the exact reference bytes; automated tests and the runner reject changes.

The **315 cases** contain:

- 90 temporal-usage review cases (18 construction families).
- 10 aspect-review cases (two families).
- 10 explicit cross-sentence reference cases (ten paragraph groups).
- 25 finite-form correction cases (five families), retained as an independent comparison.
- 180 valid controls, including mixed Methods/Results/Discussion tenses, established knowledge, epistemic modals, interval/relative-clause attachment, quotations and scientific notation.

The primary held-out subset reserves whole positive construction families 21–25, with their controls; contextual controls and the supplementary discourse set have additional reserved entries. Combined held-out evaluation has **30 positive cases and 45 controls**. Five lexical variants share each primary family, and the supplementary anaphor variants share substructures with development. This engineer-authored set is not independently annotated or externally blinded; neither 315 sentences nor a perfect reserved-family result proves broad language coverage.

During development, only development/regression individual outcomes were used to tune rules. `pre-freeze-diagnostic.json` preserves an early uncommitted-code diagnostic run (including generated but uninspected held-out rows); it is **not** presented as a frozen-code independent evaluation. `first-evaluation.json` records the production engine frozen at **e9217db** before inspection of the reserved individual outcomes. Later safety/quotation/lexical-have checks and paragraph normalization are recorded separately in the final **3f1d87f** audit. They leave the measured corpus outcomes unchanged. No expected outcomes were changed and no rule was added to hide the remaining D09 miss.

`baseline-initial-295.json` retains the first baseline before the separately frozen discourse supplement. `baseline.json` contains the identical 315-case comparison; `improved.json` is the current audit. Existing v2 and older reports remain intact; the older-corpus safety audit is a new file, not a replacement for earlier results.

## What is assessed independently

Detection counts each expected defect group once, using its annotated target's UTF-16 range. A relevant Grammar diagnostic must overlap that target. Multiple cards cannot earn multiple detections. Precision is TP cases / (TP cases + extraneous Grammar cards); recall is TP cases / positive cases. This mixed case/card metric is a diagnostic proxy, not token-level precision on arbitrary manuscripts. Family-macro recall and exact duplicate-card counts are reported separately.

Each review case intentionally has **no accepted automatic correction**. `referenceRewrite` illustrates a grammatical alternative, not the author's intended chronology, and is never scored as permission to rewrite it. Temporal findings, aspect findings and form corrections have separate denominators. Finding 109 temporal/aspect concerns does **not** mean completing 109 corrected sentences.

The 25 form cases require exact accepted complete outputs, not partial fixes. Offered completeness uses a bounded search over actual nonoverlapping suggestions (five alternatives, five cards, 2,048 search nodes). First-choice completeness applies first alternatives in descending source order, with normal revision/span validation. Proposal correctness is exact accepted output for these single-transaction cases. It is not an accept-all feature in the application.

Meaning checks independently compare numerical tokens, epistemic language and explicit temporal connectors, and count any proposed automatic repair on a review-only temporal target. These are **surface invariants**, not a semantic proof or a count of scientifically false conclusions. For example, native `SinceDuration` offered `for …` and `since … ago`; choosing between these without the author's intention is now deferred. A zero invariant count does not certify arbitrary spelling suggestions or unknown scientific terminology. The previously documented `microbeads` risk remains outside this new temporal corpus.

`--check` enforces the frozen observed regression contract: no newly missed positive cases except the explicitly reported D09 limitation, no flagged valid controls, no incomplete form outcomes, and no automatic temporal/meaning-marker changes. D09 remains labeled as an expected warning and counted as a miss, not silently relabeled to pass. First-pass and historical reports are never overwritten by CI.

## Interpretation and remaining limitations

Temporal analysis observes finite tense, perfect/progressive aspect and passive voice, then associates them with local explicit anchors and links. It recognizes initial temporal clauses, bounded past dates, rolling intervals, starting points versus durations, past `by the time` references and explicitly backward-linked adjacent sentences. It distinguishes `by microscopy` from a temporal boundary and `samples collected yesterday` from the date of the main event. Section labels provide boundaries, **not a required tense**. Ordinary adjacent past, present, perfect and modal statements remain valid without an explicit conflicting reference.

Findings are conservative review prompts. Scientific claims, chronology, completion versus continuation, voice and causal interpretations are not automatically rewritten. Clear form selection remains separately correctable. Lexical possession such as “have monitoring data” must not become “have monitored data”; ambiguous `have …ing` and malformed stative chains cannot select a new aspect automatically.

D09 is still missed: “The incubation lasted 30 min yesterday. At that point, we have collected the supernatant.” The first predicate is not in the observed verb lexicon, so the backward-reference check abstains. Other limits include unknown predicates, noninitial ambiguous temporal/interrogative clauses, implicit cross-paragraph references, optional reporting backshift, counterfactuals, arbitrary calendar/event-order reasoning and scientific facts. The system does not force all past narrative into the past or all scientific knowledge into the present.

Baseline and candidate use the same dependency tree and references. To rerun the baseline, archive **d304819** into a separate directory, provide the same installed `node_modules`, and redirect only the runner's `Proofreader`/model imports to that archived source. Never run `--baseline` against changed production source and overwrite the committed baseline. `SOURCE_COMMIT` identifies the source used; hashes, environment, raw outputs, per-case timing and end-of-run process memory are included.

Performance is a single-process Node/Vite-node observation with diagnostics/report retention enabled. RSS includes WASM, JIT and the harness; it is neither isolated engine peak memory nor browser memory. Cold outliers are recorded as well as median/p95. No Microsoft Word comparison was conducted.
