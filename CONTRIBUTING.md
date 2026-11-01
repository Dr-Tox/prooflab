# Contributing to ProofLab

Use Node 22.12+ and `npm ci`. Keep dependency changes explicit and commit `package-lock.json`.

Before proposing a change:

```sh
npm run format
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

Add tests for changes in correction offsets, storage consent, rule semantics, dictionaries, scientific preservation, and privacy boundaries. Use synthetic text only. Browser tests exercise real Harper in the production worker; do not mock grammar results. Add expected non-corrections as well as corrections for scientific rules. Include emoji and non-ASCII fixtures for offset changes.

Do not add remote processing, analytics, third-party runtime resources, accounts, automatic document persistence, or text-bearing logs/URLs. Review CSP, service worker caching, and network behavior when changing dependencies. Do not weaken the production CSP to make a test pass. Read PRIVACY.md for what the tests can and cannot establish.

Scientific rules should have narrow documented triggers, reviewable explanations, and manual-review-only behavior when they could affect meaning or quantitative expressions. Never claim universal grammar detection or scientific validation. Do not automatically infer chemical identities or gene substitutions.

Keep accessibility labels, keyboard editing, mobile layout, plain-text offsets, and undo behavior usable. Rich text support is intentionally limited; test DOM changes with corrections spanning inline nodes. Formatting is not document serialization.

Pull requests run tests without deployment permissions. Pages deployment occurs only from main after verification. Follow Apache-2.0 attribution requirements for Harper; retain its bundled license and notices when updating it.
