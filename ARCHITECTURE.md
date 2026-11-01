# ProofLab architecture

## Data flow

```text
Rich editor DOM → canonical plain text → module worker
                                        ├─ Harper WASM (English)
                                        └─ deterministic scientific rules
Worker → serializable issues → highlighted review / suggestion cards
Accept → stale-offset validation → DOM Range replacement → reanalysis
Settings / dictionary → IndexedDB
Document → memory (or IndexedDB only with explicit consent)
```

`src/model.ts` defines issues, settings, profiles, protected ranges, import/export, and correction validation. An issue has a stable per-analysis ID, rule ID, category, UTF-16 start/end offsets, original text, replacements, and explanation.

`src/engine.worker.ts` owns Harper and delegates normalization to the testable `src/proofreader.ts` adapter. Requests are serialized to avoid configuration/dialect races. The UI debounces input and discards results from old revisions. Harper 3.0.0 already returns JavaScript UTF-16 spans (verified with emoji in real-engine tests); every span must reproduce Harper's original problem text before it can be displayed. Unexpected spans are rejected with a mapping-failure warning rather than used for a correction; development diagnostics record the rejection reason. `src/diagnostics.ts` validates integer bounds and exact source slices without normalization or guessed relocation. Resources for spans, suggestions, and lints are released after serialization.

`src/engine.ts` is a request/response bridge. A fatal worker error rejects both pending and future requests, so subsequent edits cannot hang indefinitely. Worker errors are shown locally; they are never remotely logged. The worker can block during WASM analysis without blocking the editing UI. Very large documents may still be expensive; this release has no streaming or chunked paragraph analysis.

`src/contextual.ts` adds only a narrow, configurable manual review for `last nigh`; it does not attempt general contextual grammar correction or ambiguous possessive substitutions. `src/scientific.ts` contains deterministic, conservative pattern checks. Scientific review-only rules expose no replacement actions. The scientific dictionary is filtered in the adapter, not imported into Harper, to preserve case-sensitive scientific terms. Whole accepted terms suppress contained spelling spans, including components of hyphenated terms. They do not suppress grammar warnings.

## Editor and correction history

The browser contenteditable supports bold and italic. Input is a linear stream of text nodes plus inline formatting nodes; keyboard newlines and paste are inserted as plain text through DOM Ranges. A terminal BR supports caret placement after a trailing newline without contributing to text offsets. Paste and drop never import HTML. Text is not placed into `innerHTML` from an external source. The only `innerHTML` assignment restores a session-generated undo snapshot.

The analysis highlight view is separate from the editing DOM. This avoids continuously rewriting a live contenteditable and disturbing the caret, selection, or composition. Highlight clicks select the corresponding analysis card. Overlapping issues remain visible in cards even when only the first can be represented in the highlight view.

Accepting a correction validates the current slice, records a text/HTML history snapshot, walks text nodes, and replaces a DOM Range. Subsequent analysis recalculates offsets. There is no automatic batch correction in the UI. The pure `applyMany` helper tests simultaneous nonoverlapping changes and rejects overlaps. Undo snapshots are bounded to 100 and remain in memory. Copy, optional saving, and restored documents use plain text; formatting does not persist across reloads.

Native browser spellchecking and autocorrection are disabled on the document editor to avoid conflicting suggestions and browser-assisted remote checking. Browser/OS features and extensions remain outside the app's security boundary. Advanced rich-text structures, embedded objects, tables, tracked changes, and citation manager round-trips are not supported. Browser `execCommand` is used only for inline formatting; it is deprecated but currently supported in the target Chromium test browser. Cross-browser editing/IME behavior needs further coverage before claiming full browser parity.

## Settings and persistence

`src/storage.ts` uses IndexedDB via `idb`, database `prooflab`, store `local`, version 1. Keys are `settings`, `dictionary`, and optional `document`. Separate settings fields hold ignored words, ignored rules, preferred substitutions, and per-rule overrides. No hashes or excerpts from documents are persisted to implement dismiss-once. Dismissal IDs stay in session state and reset after text changes.

Profiles establish defaults; an explicit per-rule override takes precedence, and globally ignored rules take highest precedence. Harper's own default configuration is discovered. Settings updates are queued, and consent plus the document copy are committed atomically in a single IndexedDB transaction. The UI reports when local changes have finished saving; users should wait for this status before closing or reloading. No document is saved before stored settings are loaded. Storage failures produce a local notice and leave session work usable. Local data is not encrypted and there are no accounts.

## Build and offline support

Vite bundles all JS, CSS, icons, and WASM. Tailwind runs at build time. There are no runtime CDNs or external fonts. The worker uses ES module output to support Harper's loader chunks. VitePWA/Workbox precaches only enumerated static assets; no document data or arbitrary runtime requests are cached. The WASM precache limit is explicitly raised to 30 MB. Browsers may evict caches or reject storage under quota pressure. Application updates are not forced mid-edit; refresh at a safe time to activate a new version.

The CI first builds and tests at `/` using the production CSP, then builds the deployment artifact at the repository subpath for GitHub Pages. Production browser tests run the built app; a separate Playwright development project exercises diagnostics with Vite HMR on loopback. Development CSP transformation applies only to the live dev server, and Harper is excluded from dependency optimization to preserve package-relative WASM URLs. The deployed application has no backend.

## Development engine observability

The worker gates raw diagnostic capture, console logging, and reply data behind `import.meta.env.DEV`; the UI uses the same guard for `EngineDiagnosticsPanel`. No URL flag or persisted setting can enable diagnostics in production. Snapshots contain initialization status, applied active rules, raw/accepted/custom/final counts, raw serialized lints, and discard reasons. They stay in browser memory/console only and can expose excerpts to someone with DevTools access. Do not use sensitive documents while debugging. The panel separates visible issues (after UI filters/dismissals) from accepted engine findings. New input clears the previous diagnostic snapshot, and only the current request revision updates it.

The normal empty state is “No issues detected by the enabled rules”, with distinct messages for filters, dismissed findings, mapping failures, and engine failures. It does not certify that the writing is correct. Spelling-disabled settings also get an explicit notice.
