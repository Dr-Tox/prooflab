# ProofLab

Private English and scientific proofreading, entirely in your browser. React, TypeScript, Vite, Tailwind CSS, Harper WebAssembly, and IndexedDB. No AI models, remote grammar services, accounts, analytics, or cloud document storage.

## Develop

Use Node.js 22.12+ and npm. The lockfile pins the dependency graph.

```sh
npm ci
npm run dev
```

Open the local Vite URL. Development mode includes a local engine diagnostics panel and logs raw lint excerpts to the browser/worker console. Use synthetic text when debugging. Diagnostics are session-only and are neither remotely logged nor persisted. The dev server permits Vite’s inline preamble/styles and loopback HMR; the production build and preview retain the restrictive production CSP and have no diagnostics panel or raw-lint logging. Harper is excluded from Vite dependency prebundling so its relative WASM URL remains valid in development. The offline service worker is enabled only in production builds. Use `npm run build && npm run preview` for production/privacy checks.

```sh
npm run build
npm run preview
npm test
npx playwright install --with-deps chromium
npm run test:e2e
npm run format:check
```

Browser tests use the built production application on port 4173. Rebuild after source changes. If using a custom Playwright browser location, set `PLAYWRIGHT_BROWSERS_PATH` consistently for installation and testing.

## Features

- Real Harper grammar, spelling, punctuation, common word confusion and selected agreement/style rules; all available rule switches are discovered at runtime.
- Rich editing with bold/italic, plain-text paste, live counts, highlighted review, issue filters, accept/dismiss/undo, and copy text.
- Three writing profiles, per-rule overrides, separate ignored words/rules, and manual preferred terminology reviews.
- Case-sensitive scientific dictionary, TXT/JSON import/export, local IndexedDB persistence.
- Conservative scientific checks; no automatic correction or scientific validity claims.
- Document content stays in memory by default. Local saving requires explicit consent in Settings; revoking consent deletes the saved copy.
- Installable PWA with the engine and application assets precached. Wait for the offline-ready message before disconnecting. Installation UI depends on browser support.

The highlighted review is a separate plain-text rendering, so formatting cannot shift correction offsets. Bold/italic formatting is session-only; copying and optional local saving use plain text. The editor deliberately does not import rich clipboard HTML or arbitrary embedded content. See [ARCHITECTURE.md](ARCHITECTURE.md) for editor limitations.

## GitHub Pages deployment

The `Pages` workflow runs unit and production browser tests on pushes to `main` and pull requests. Deployment runs on `main` only, after verification succeeds.

1. In GitHub **Settings → Pages → Build and deployment**, choose **GitHub Actions**.
2. Push or merge this application into `main`.
3. The workflow builds with `BASE_PATH=/prooflab/` (computed from the repository name), uploads `dist/`, and deploys Pages.

For a user/organization root site, use `BASE_PATH=/`. For another static host, build with its path and serve `dist` via HTTPS. Never deploy the source tree or `node_modules`. The Pages workflow requests only read access for tests; Pages write and identity permissions are scoped to the deploy job. The CI workflow does not need application secrets.

GitHub Pages does not offer arbitrary response headers. The HTML includes a restrictive CSP; a host that supports response headers should also send `Content-Security-Policy`, `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and `frame-ancestors 'none'` in its CSP response header. `frame-ancestors` cannot be enforced from a CSP meta element.

## Verified dependency and license

Harper **3.0.0**, package `harper.js`, is Apache-2.0 (verified from the published package metadata and shipped LICENSE on 2026-10-30). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and [LICENSES/Harper-Apache-2.0.txt](LICENSES/Harper-Apache-2.0.txt).

The shipped declarations confirm `LocalLinter`, `harper.js/binary`, `setup`, `organizedLints`, `getLintConfig`, `getLintDescriptions`, `setLintConfig`, `setDialect`, `Lint.span`, `get_problem_text`, and `Suggestion.kind/get_replacement_text`. The app uses `LocalLinter` inside its own ES module worker; it does not invent or mock a Harper API. Vite emits the 20.4 MB full WASM file as a same-origin asset; compression and browser storage quotas affect first-load installation. The `fs` externalization warning comes from Harper's unused Node loading path, not a browser dependency on a remote service.

## Limitations

English proofreading is heuristic and incomplete. Harper supports selected agreement constructions; ProofLab makes no claim of comprehensive subject–verb agreement or scientific understanding. Scientific rules cover explicit patterns, not an ontology. Gene/formula protection is conservative and cannot recognize every identifier. Every correction requires an explicit click; review the context yourself. There is no “accept all”. Offline availability depends on a complete cache, browser support, and storage retention.

Read [PRIVACY.md](PRIVACY.md), [RULES.md](RULES.md), and [CONTRIBUTING.md](CONTRIBUTING.md).

## Detection limits and diagnostics

Harper 3.0.0 produces **zero raw lints** for `I wanted to visit mi uncles last nigh`. Its dictionary accepts `mi` and `nigh`; it does not infer the intended pronoun, time expression, or possessive. This is not a promise of complete contextual grammar correction. ProofLab adds a narrow **manual-review-only** warning for `last nigh`, without replacing `mi`, changing `uncles`, or choosing an apostrophe. Individual rules can still be disabled in Settings.

In `npm run dev`, the Editor’s **Engine diagnostics** panel shows initialization, the actual active Harper rules, raw/accepted/custom/final counts, discarded lint reasons, and raw lint snapshots before filtering. For the reported sentence, expect raw **0**, accepted Harper **0**, custom **1**. For `recieve`, `usefull`, and `teh`, expect real Harper spelling findings. A zero raw count indicates an engine coverage gap; a nonzero raw count with discarded findings points to dictionary/protection/deduplication or span validation. Rule overrides, category filters, and dismissed occurrences can also affect the visible count. See [RULES.md](RULES.md).
