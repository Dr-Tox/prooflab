# ProofLab rules and safety policies

Harper 3.0.0 remains the real local baseline. Its documented `LocalLinter`, `organizedLints`, rule configuration, dialect, spans and replacement APIs are verified against the installed declarations and actual WASM results. Nothing substitutes mock grammar findings in the application.

## Precedence and classification

`src/policy.ts` is the centralized conflict policy: preserve numerical tokens and epistemic caution; preserve curated/user-approved terms and recognized measurement tokens; retain grammatical corrections that leave those tokens intact; prefer coordinated/high-confidence grammar; then contextual warnings and editorial preferences. It does not discard every overlapping diagnostic. An issue spanning `TNF-α are` may change the verb while retaining the identifier. Unknown identifier-like tokens get manual review, not certification or an unrelated replacement.

Category labels are coarse: Grammar, Spelling, Punctuation, Scientific, Style. Source Harper IDs are retained when one defect is grouped. Identical-span compatible findings become one card; conflicting alternatives are marked and the higher-priority proposals retained. Coordinated mass-noun edits subsume related partial lexical suggestions. Genuinely independent intersecting defects remain separate and may require successive fresh analyses.

## Grammar additions and scope

`src/linguistics/` adds a deterministic shallow clause analyzer. Productive noun-number morphology, irregular plurals, determiners and pronouns identify subject number without the old head-noun whitelist. Bounded noun phrases preserve the head across prepositional phrases and complete passive subject-relative clauses. Coordinated subjects, each/every, existential clauses, and a/the number versus a series receive distinct treatment. The existing **Bounded agreement** setting ID is retained for compatibility.

**Verb forms** checks modal/do + base, have + participle, passive chains, and selected ongoing constructions. It uses an explicit verb paradigm lexicon rather than guessing unknown verb spellings. Agreement and verb-form/preposition edits in the same recognized clause form one transaction. Explanations identify the subject head and the required form. **Tense context review** gives a warning, without a replacement, for a perfect construction tied to an explicit completed past time. It does not impose a manuscript-wide tense or change scientific hedging. These rules are enabled in all profiles and remain independently configurable.

This is a partial analyzer, not a general POS/dependency parser. Unknown lexical verbs, object relatives, disjunction, appositives, complex coordination and many subordinate clauses deliberately abstain. Passive-versus-continuous ambiguity requires explicit evidence or selected laboratory patient/action semantics; it is not resolved by guessing an author's intended agency. Valid adjective predicates such as “was complete” are preserved.
Other narrow additions check plural existential constructions, forms of `depend of → depend on`, and sentence-initial `Its + selected adjective + to/that → It’s`. Possessive `Its importance` is preserved. Selected pluralized mass nouns after `these/those` coordinate the demonstrative, noun and copula as one transaction: **These informations are useful → This information is useful**. A noun-only replacement is not counted as a full correction.

Potential run-ons/comma splices, a standalone subordinating clause ending in a full stop, and selected introductory laboratory modifiers with equipment subjects receive **review warnings**, never agency-changing rewrites. Headings/lists and recognized subordinate-main-clause structures are conservatively excluded. **After centrifuging the samples, the supernatant was collected** is not a dangling-modifier warning. The structure checks are limited templates with lexical guards, not comprehensive sentence parsing.

## Scientific terminology and SI

The curated vocabulary is separate from the user's persistent accepted terms and ignored words. See [SCIENTIFIC_VOCABULARY.md](SCIENTIFIC_VOCABULARY.md) for original authorship, no imported lexicon, maintenance, case policy, and narrow technical-misspelling suggestions. `centrifugation` and `supernatant` are valid, while tested misspellings remain detectable. Unknown words are not all accepted simply because they look technical.

Selected SI cases offer value-preserving notation corrections: `10mg → 10 mg`, `37°C → 37 °C`, `300 °K → 300 K`. Ordinary/NBSP separators, Unicode minus/micro symbols, superscript/exponent quantities, selected compound units and multiplication notation are supported. `30 min`, `5 mg/kg/day`, `TNF-α`, `IL-1β`, `p = 0.08`, and `95% confidence interval` are preserved. Symbol coverage remains finite. V2 adds common SI prefixes for electrical symbols (including `mV`), narrow sentence-final spelling protection, and relative centrifugal force such as `3,000 × g`. The earlier second-round `mV` failure remains preserved in its historical report. Do not interpret this checker as a complete SI parser or accept all proposals blindly.

`ml/mL` is an explicit optional preference. Statistical significance alone is not a reporting problem. Reporting reminders for selected proof/causal phrasing are opt-in and clearly review-only. Replacements that change numerical tokens, negation, or listed epistemic markers are removed; this is a conservative safety guard, not a proof of semantic equivalence.

## Legitimate repetition

Repetition policy suppresses ambiguous `that that`, grammatical `had had`, emphatic/modal homographs, and selected fused-relative `What is is` constructions across custom and conflicting native repetition rules. High-confidence adjacent function-word mistakes such as `the the` can offer one-word corrections. Other uncertain repetitions are manual review. This trades some accidental-repetition recall for fewer damaging false positives; it does not claim universal distinction between deliberate and accidental repetition.

## Profiles and overrides

| Rule family                                            | General English | Academic English | Scientific Writing |
| ------------------------------------------------------ | --------------- | ---------------- | ------------------ |
| Native Harper grammar/spelling defaults                | Native defaults | Native defaults  | Native defaults    |
| Native `Expand*` editorial expansions                  | Native defaults | Native defaults  | Off by default     |
| Subject/verb analysis / structure / contextual reviews | On              | On               | On                 |
| Conservative repeated words                            | On              | On               | On                 |
| Academic redundancy                                    | Off             | On               | On                 |
| SI spacing / SI notation / abbreviation case review    | Off             | Off              | On                 |
| Unit consistency preference / reporting reminders      | Off             | Off              | Off                |
| User terminology preferences                           | On              | On               | On                 |

An ignored rule is disabled; otherwise an individual override takes precedence over the profile. Scientific safety still filters harmful proposals even when a native rule is explicitly enabled. Choosing “Prefer mL” enables the optional notation rule; its switch/ignore controls remain available. Existing saved settings are loaded with defaults for new fields. General visual design, individual accept/ignore/Undo, local dictionaries and opt-in saving remain intact.

## Revision, offsets and transactions

Harper's `span()` already reports end-exclusive UTF-16 indices compatible with `String.slice`; `get_problem_text()` must match the source. Do not normalize, reconvert, or relocate mismatched spans. Invalid spans produce mapping warnings rather than a clean result. Development-only diagnostics retain raw counts and discard reasons locally.

Every analysis response and generated issue carries a revision. Text/settings/dictionary changes immediately invalidate prior suggestions; formatting-only changes trigger fresh analysis too. The bridge checks the returned revision, and accepting a correction checks both revision and original span. Coordinated edits are validated as a whole for bounds, source slices, overlap, and consistency with the displayed replacement. DOM changes apply atomically from right to left, preserving unrelated inline formatting; rollback/Undo restore the previous HTML, plain text and caret/selection context. Every accepted correction is reanalyzed. There is no automatic accept-all action.

The exact earlier sentence `I wanted to visit mi uncles last nigh` still illustrates native contextual limits: Harper returns zero raw lints. Only the narrow `last nigh` manual review is added. No pronoun inference or ambiguous possessive replacement is invented.
