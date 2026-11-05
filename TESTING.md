# ProofLab verification

Test fixtures contain synthetic writing only. No real documents or external grammar services are used.

## Automated coverage

`npm test` runs the unit/integration and quality tests across the model, real Harper adapter, diagnostics/span validation, worker transport failures, and IndexedDB modules:

- Real Harper spelling and selected agreement; emoji/UTF-16 offsets; stale corrections.
- Actual Harper rule enable/disable and US/UK dialect behavior.
- Scientific terms, formulas, gene-like symbols and statistical value preservation.
- Case-sensitive dictionary acceptance, removal, validated TXT/JSON round-trips, and malformed import rejection.
- Profile defaults, individual overrides, ignored-rule precedence, deterministic science rules and expected non-corrections.
- Simultaneous nonoverlapping corrections and rejection of overlaps.
- Separate persistent settings/dictionary/document records and atomic consent revocation.

`npm run test:e2e` runs thirteen Chromium production scenarios and one real Vite development diagnostics scenario:

1. Real engine suggestions with emoji, accept and undo.
2. Scientific dictionary persistence, add/remove, import and export.
3. Rule overrides and single-occurrence dismissal.
4. Network monitoring, default non-persistence, CSP external-fetch rejection, cached offline reload and new offline proofreading.
5. Mobile overflow checks, local-saving opt-in, restoration and revocation.
6. Rich formatting across inline-node corrections, newline editing, confirmation before clearing, and undo.
7. Sequential corrections with changing offsets and clipboard copy.
8. Global rule ignoring/restoration and review-only terminology preferences.
9. The reported contextual sentence produces a manual review; unsupported contextual errors retain an honest empty state, with no production diagnostics/logging or weakened CSP.
10. Misspellings, agreement, repetition, and editor updates in every profile; category filters do not imply a clean document.
11. Fatal worker load failure and subsequent edits show an error, never a clean document.
12. Atomic three-part mass-noun correction, preserved inline formatting, exact text restoration and caret context through Undo.
13. Valid scientific repetition/units are preserved, and SI corrections leave values intact.

The separate development scenario checks initialization, raw **0** / Harper-accepted **0** / custom **1** for `I wanted to visit mi uncles last nigh`, local raw console snapshots for actual Harper findings, applied rule changes, dictionary discard reasons, and lack of network/persistence leakage of a unique synthetic input marker. It uses the real WASM module rather than mocked grammar results.

The original new regression was run against the prior implementation and failed because no `Time expression review` finding existed. Direct Harper characterization independently produced zero lints. The fix retains the exact span guard: none of the tested valid native findings are discarded for a source mismatch. Pure validation tests reject deliberately invalid/mismatched ranges without relocating an ambiguous repeated word. A transport-only Worker test simulates a fatal worker error; real-engine grammar tests are not mocked.

The suite supports both `/` and GitHub Pages `/prooflab/` hosting paths:

```sh
npm run build
npm run test:e2e
BASE_PATH=/prooflab/ npm run build
PROOFLAB_BASE_PATH=/prooflab/ npm run test:e2e
```

The preview server must use the same base path as the build; the Playwright configuration sets it automatically from `PROOFLAB_BASE_PATH`. GitHub Actions runs both configurations, then publishes the repository-path artifact after verification.

`npm run format:check` checks source formatting. `npm run build` runs strict TypeScript checks and builds the production app, worker, full WASM, bundled licenses, manifest and static precache. `npm audit --omit=dev` checks production dependencies against the registry advisory snapshot; it is not a guarantee of safety or a replacement for review.

## Manual checks and limits

Desktop (1440 px) and mobile (390 px) layouts were visually inspected. Scientific preservation is pattern-based, not comprehensive. Automated browser coverage currently targets Chromium only; Firefox, Safari, IME/accessibility-tool combinations, storage eviction, browser installation prompts, and every rich-text interaction need additional manual coverage. Browser tests wait for acknowledged IndexedDB commits before reloading. An abruptly closed browser can interrupt pending local writes.

Read PRIVACY.md for the network test's limits and the hosting/browser/device threat model. Local tests do not establish that GitHub Pages has been enabled or that a remote CI job has passed; those are reported separately on the pull request/workflow.

## Quality benchmark and evaluation integrity

`npm run benchmark` uses actual Harper outputs and the production adapter. The 50 development cases and 21 prior-behavior cases are unit-test quality gates. Original held-out references and second-round references are byte-hash checked but their misses are not converted into implementation-specific pass assertions. Reports retain full actual outputs and independently score detection, category, offered replacement, complete correction, safety proxies, false positives, duplicates and timing. CI runs the development/regression measurement in addition to tests.

The old protected-range blanket heuristic has been removed from decision making. Tests verify surrounding grammar can be corrected while technical identifiers stay intact, unsupported heads are not guessed, numeric/hedge changes are rejected, and a stale revision is rejected even when its original span still matches. Independent overlapping errors can be resolved through successive fresh analyses. Read benchmark/README.md and BENCHMARK_RESULTS.md for held-out leakage accounting and the remaining mV/unknown-head limitations.
