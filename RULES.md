# ProofLab rules

All findings are suggestions. No correction is automatic. Results, statistical values, chemical formulae, likely scientific identifiers, conclusions, and causal interpretations require human review. There is no accept-all action.

## Harper English rules

Harper 3.0.0 provides real on-device spelling, grammar, punctuation, common confusion, capitalization, selected agreement, and style checks. The application discovers supported rule identifiers and descriptions from `getLintDescriptions()` and defaults from `getDefaultLintConfig()`. Settings lists those rules without assuming unsupported APIs or inventing detectors. Coverage is heuristic and incomplete; subject–verb agreement support is limited to the rules actually shipped by Harper. US/UK preferences use Harper's `Dialect.American` and `Dialect.British`; not every regional vocabulary difference is necessarily detected.

Issue categories normalize Harper's Spelling and Punctuation kinds directly; Style, Readability, Redundancy, and Enhancement become Style. Other kinds become Grammar. Scientific pattern warnings use Scientific. The raw source rule ID and explanation remain visible.

## Deterministic additions

| Rule                     | Trigger                                                                         | Action                                                        |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Repeated words           | Adjacent identical alphabetic words, case-insensitive, separated by spaces/tabs | Suggest one word; intentional repetitions need review         |
| SI spacing               | Value directly adjacent to mg, kg, µg, μg, ng, mL, mm, cm, nm, mmol, or mol     | Manual review only; toggle in Settings                        |
| Unit consistency         | Both mL/ml or µg/μg appear                                                      | Manual review of notation; never converts values              |
| Abbreviation consistency | Dictionary term containing capitals appears in another case                     | Manual review; no global identifier renaming                  |
| Academic redundancy      | “in order to”, “at this point in time”, “past history”, “completely unanimous”  | Offer a shorter phrase; author checks context                 |
| Terminology convention   | “statistically significant”, “proved that”, or “proves that”                    | Manual evidence/reporting review; does not assert correctness |
| Preferred terminology    | Literal case-sensitive occurrence of a user-specified source phrase             | Show preferred phrase for manual editing                      |

SI checks do not parse arbitrary scientific notation or dimensions. Consistency checks do not infer whether a symbol denotes a different chemical, gene, or unit. Dictionary-based abbreviations do not detect every undefined abbreviation or abbreviation expansion. The terminology warning is not a recommendation to remove legitimate statistical language.

## Profiles and precedence

| Group                                        | General English | Academic English | Scientific Writing |
| -------------------------------------------- | --------------- | ---------------- | ------------------ |
| Harper native default rules                  | On as shipped   | On as shipped    | On as shipped      |
| Repeated words                               | On              | On               | On                 |
| Preferred terminology                        | On              | On               | On                 |
| Academic redundancy                          | Off             | On               | On                 |
| SI, units, abbreviations, terminology review | Off             | Off              | On                 |

Ignored rule → disabled; otherwise explicit individual override → chosen state; otherwise profile default. Changing profiles preserves overrides. Restore defaults resets preferences and ignored lists, revokes local-saving consent, and keeps the dictionary. Scientific terms and ignored words are separate from ignored rules and substitution preferences.

## Preservation and offsets

Numerical expressions, mixed/all-capital identifiers, gene-like hyphenated symbols, and letter/digit formula patterns receive conservative protected spans. Overlapping Harper suggestions have no replacement actions; spelling warnings for such identifiers are suppressed. Scientific rules touching results or identifiers are review-only. The patterns are not a chemical/gene parser and cannot protect every possible symbol; authors must inspect changes.

Accepted dictionary words suppress only spelling suggestions covering those complete, case-sensitive terms or their components. Lowercase `pfas` is not automatically accepted because `PFAS` is in the dictionary. Rule IDs, start/end offsets, original text, replacements, explanations, and category are retained for every finding. A replacement is rejected if the current document slice no longer matches the original text.

## Example expectations

- `This is a usefull observation.` → Harper suggests `useful`.
- `The the sample was measured.` → repeated-word suggestion.
- `In order to compare groups` → optional `to compare groups` in academic/scientific profiles.
- `10mg` → manual spacing warning, no numeric replacement.
- `PFAS and pfas` → case-consistency review, no identifier replacement.
- `The sample contained 3.14 mg of PFHxA.` → no custom scientific warning.
- `H2O`, `MYB-NFIB`, `PFHxA`, `p = 0.05` → no automatic scientific modification.
