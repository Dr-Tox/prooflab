# ProofLab verification

Test fixtures contain synthetic writing only. No real documents or external grammar services are used.

## Automated coverage

`npm test` runs 14 tests across model, real Harper adapter, and IndexedDB modules:

- Real Harper spelling and selected agreement; emoji/UTF-16 offsets; stale corrections.
- Actual Harper rule enable/disable and US/UK dialect behavior.
- Scientific terms, formulas, gene-like symbols and statistical value preservation.
- Case-sensitive dictionary acceptance, removal, validated TXT/JSON round-trips, and malformed import rejection.
- Profile defaults, individual overrides, ignored-rule precedence, deterministic science rules and expected non-corrections.
- Simultaneous nonoverlapping corrections and rejection of overlaps.
- Separate persistent settings/dictionary/document records and atomic consent revocation.

`npm run test:e2e` runs eight Chromium scenarios against a production build:

1. Real engine suggestions with emoji, accept and undo.
2. Scientific dictionary persistence, add/remove, import and export.
3. Rule overrides and single-occurrence dismissal.
4. Network monitoring, default non-persistence, CSP external-fetch rejection, cached offline reload and new offline proofreading.
5. Mobile overflow checks, local-saving opt-in, restoration and revocation.
6. Rich formatting across inline-node corrections, newline editing, confirmation before clearing, and undo.
7. Sequential corrections with changing offsets and clipboard copy.
8. Global rule ignoring/restoration and review-only terminology preferences.

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
