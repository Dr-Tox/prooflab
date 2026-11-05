The original corpus is retained byte-for-byte with its original SHA-256. Two
**development** references (`verb-03-4`, `verb-06-4`) incorrectly demand a passive
rewrite of the valid adjectival predicates “was complete yesterday” and “has
been complete twice”. The scorer treats these as no-issue controls, preserving
the input. This correction was identified during development, before inspection
of individual held-out engine outputs. It does not change held-out references.
The same amendment is applied when rerunning baseline and candidate engines.

The first aggregate evaluation used a defective minimal-difference matcher:
insertions such as conduct→conducted had an empty source interval. This caused
false detection misses despite correct offered corrections. Both engines are
rescored using source-token expansion for insertion-only references. The first
report is preserved as `first-evaluation-scorer-v1.json`; it is not a comparable
final score. No reference outcomes were changed to fix this scoring bug.

A final reference-language audit found a third development-label error:
`verb-10-2` originally accepted “She does not agree the result.” This is still
ungrammatical: the complete correction is “She does not agree **with** the
result.” The scorer now requires that complete outcome for both engines.
No rule was added to pass this case; the remaining partial correction is reported
as a failure. No derived correct-control entry contains that invalid sentence.
This amendment reduces the candidate's complete-correction score; it does not
change held-out labels. Earlier reports retain the earlier, overly generous
reference and must be interpreted using this erratum.
