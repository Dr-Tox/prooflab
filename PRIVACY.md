# ProofLab privacy and threat model

## Data and connections

ProofLab has no remote proofreading, AI models, authentication, synchronization, analytics, advertising, crash reporting, or telemetry. All document analysis runs in a browser worker using bundled Harper WebAssembly. User document content is never intentionally transmitted by application code, placed in URLs, logged to a remote endpoint, or included in service worker caches.

Initial loading and later application update checks request static assets from the hosting origin. The host can see ordinary HTTP metadata such as IP address, request time, and browser headers. The grammar binary is approximately 20.4 MB uncompressed. No external fonts, CDN scripts, or remote model files are loaded.

The production HTML sets `default-src 'none'`, same-origin script/style/image/font/manifest sources, `connect-src 'self'`, and `worker-src 'self' blob:`. WebAssembly compilation requires `'wasm-unsafe-eval'`; arbitrary JavaScript evaluation is not enabled. Forms, plugins, and base-URL changes are disabled. A no-referrer policy prevents document URLs from being sent as referrers. The application never contains document content in its own URL.

Same-origin connections permit static assets and service worker update checks. They are **not** an independent data-loss prevention firewall: a future code bug could still make a same-origin request carrying content. Dependency review, the narrow asset-only application design, source review, and network regression tests provide additional assurance. CSP from HTML also cannot set `frame-ancestors`, cannot cover the initial navigation, and does not replace secure hosting. A separately served worker does not inherit a document meta CSP in all contexts; this worker contains only the audited same-origin Harper loader and local rules. Hosts that support response headers should apply a CSP to worker responses too. The absence of external worker requests is covered by the network regression test, not by a claim that a document meta policy is a worker firewall. For stronger isolation, serve audited builds offline or on an isolated local origin and disable network access after caching.

## Persistence and deletion

- Settings and case-sensitive dictionaries: local IndexedDB, retained across sessions.
- Ignored words, ignored rules, terminology preferences: distinct settings fields in IndexedDB.
- Dismissed single occurrences: memory only; reset on document edits.
- Document and undo history: memory only by default.
- Optional local saving: document plain text in IndexedDB only after the user checks the consent option in Settings. Disable it to delete the saved copy. Wait for the “Local changes saved” status before closing/reloading; storage operations are asynchronous. Clear your browser's site data to delete all settings, dictionaries, documents, and caches.
- Clipboard and exported dictionary files: only when explicitly requested; the operating system or user then controls them.
- Static assets: Cache Storage managed by the service worker. Documents are never part of the precache.

Local storage is not encrypted. Other people using the same browser profile may see it. Storage can be unavailable, cleared, or evicted. Do not treat local saving as a backup. Clearing the editor is undoable and does not securely erase RAM or operating-system copies. Disabling document saving removes the app's IndexedDB copy, not forensic traces.

## Threat boundary

We assume a trusted browser, device, operating system, application build, and hosting origin. We defend against accidental remote document processing, third-party runtime dependencies, automatic document persistence, unsafe clipboard HTML, and unintended external connections from the application.

We cannot defend against malicious browser extensions, enhanced OS/browser writing services, malware, screen capture, compromised hosting or dependencies, a malicious new release, or another same-origin app reading local storage. Browser-native spellcheck and autocorrect are disabled in the editor. Browser settings and extensions can override or bypass application controls. Use a separate browser profile/origin for sensitive work. GitHub Pages HTTPS protects transport but not a compromised application source or host.

ProofLab is a writing aid, not a security enclave or a scientific validity checker. It cannot certify that a paper is correct, confidential against a compromised device, or compliant with an institution's policies.

## Development diagnostics

`npm run dev` captures raw Harper lint excerpts/serialized data and discard reasons in browser memory and the local browser/worker console. Initialization and applied-rule state are visible in a development-only panel. No diagnostic snapshots are written to IndexedDB, put in URLs, remotely logged, or transmitted to the development server. Production builds neither render the panel nor capture/log/return raw diagnostics from the worker. Use synthetic text; browser consoles, screen sharing, extensions, and debugging traces can expose diagnostic excerpts. Clear/close the development session to remove session state; browser DevTools controls its own retained console history.

Vite development mode permits its inline preamble/styles and loopback HMR WebSockets. Production CSP remains unchanged. A dedicated browser test verifies real development-worker diagnostics, local-only requests without a unique input marker, and default non-persistence. Production tests separately verify diagnostics absence, strict CSP, and network restrictions.

## Automated network tests and limits

Playwright tests the production build with its actual CSP and service worker. It records browser-context request URLs, methods, and bodies while entering a unique document marker, checking suggestions, reloading, and using the engine offline. It verifies static same-origin GET-only traffic without the document marker and verifies that an external fetch is rejected by CSP. Tests check that default saving is absent, consent persists content, and revocation deletes it.

This is a bounded regression test. It does not prove the absence of all exfiltration paths, encoded/fragmented leaks, timing channels, browser-internal traffic, extension traffic, DNS leakage, compromised dependencies, other browsers, or every future user interaction. Service-worker interception can hide some routed network behavior from browser tooling, and hosts can retain static request metadata. Review changes touching network APIs, service workers, dependencies, CSP, persistence, clipboard, and logs. No production document content should ever be used in CI fixtures.
