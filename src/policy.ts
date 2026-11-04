import { overlaps, type Issue } from "./model";
import {
  scientificTermSpans,
  technicalCandidate,
  scientificVocabulary,
  scientificCaseVariants,
} from "./vocabulary";
import { mass } from "./grammar";
import { measurementSpans } from "./measurements";
import { legitimateRepetitions } from "./repetition";
const repetitionRules = new Set([
  "RepeatedWords",
  "Repeated words",
  "RedundantThat",
  "ThatWhich",
  "SingleBe",
]);
const lexicalRules = new Set([
  "SpellCheck",
  "SplitWords",
  "WrongNegative",
  "MassNouns",
]);
const numeric = (s: string) =>
  JSON.stringify(s.match(/[−-]?\d+(?:[.,]\d+)?/g) ?? []);
const caution = (s: string) =>
  JSON.stringify(
    (
      s.match(
        /\b(?:may|might|suggests?|consistent with|associated with|not)\b/gi,
      ) ?? []
    ).map((w) => w.toLowerCase().replace(/^suggests$/, "suggest")),
  );
export function createScientificPolicy(
  text: string,
  userWords: string[],
  ignored: string[],
) {
  const known = scientificTermSpans(text);
  const variants = scientificCaseVariants(text);
  const terms = (words: string[]) =>
    words.flatMap((word) => {
      const result: { start: number; end: number; term: string }[] = [];
      if (!word) return result;
      let a = 0;
      while ((a = text.indexOf(word, a)) >= 0) {
        const end = a + word.length;
        if (
          !/[\p{L}\p{N}_]/u.test(text[a - 1] ?? "") &&
          !/[\p{L}\p{N}_]/u.test(text[end] ?? "")
        )
          result.push({ start: a, end, term: word });
        a = end;
      }
      return result;
    });
  const user = terms(userWords),
    ignoredTerms = terms(ignored),
    measurements = measurementSpans(text);
  const identifiers = [
    ...text.matchAll(
      /\b(?:[A-Z]{2,}(?:-?[\p{L}\d]+)+|[A-Z][a-z]*\d+[A-Za-z\d]*)(?:-[\p{L}\d]+)*/gu,
    ),
  ].map((m) => ({ start: m.index!, end: m.index! + m[0].length, term: m[0] }));
  const validRepeats = legitimateRepetitions(text);
  const contained = (i: Issue, r: { start: number; end: number }) =>
    i.start >= r.start && i.end <= r.end;
  return (input: Issue): { issue?: Issue; reason?: string } => {
    const i = { ...input };
    if (
      lexicalRules.has(i.rule) &&
      mass[i.original.toLowerCase()] &&
      /\b(?:these|those)\s+$/i.test(text.slice(0, i.start))
    ) {
      i.replacements = [];
      i.explanation =
        "A mass-noun correction here also requires reviewing the demonstrative and verb. A noun-only substitution would be incomplete; review manually or enable the coordinated Mass noun agreement rule.";
    }

    if (
      repetitionRules.has(i.rule) &&
      validRepeats.some(([a, b]) => overlaps(i.start, i.end, a, b))
    )
      return { reason: "legitimate-repetition" };
    if (i.category === "Spelling") {
      if (user.some((r) => contained(i, r)))
        return { reason: "dictionary-term" };
      if (ignoredTerms.some((r) => contained(i, r)))
        return { reason: "ignored-word" };
      if (known.some((r) => contained(i, r)))
        return { reason: "scientific-vocabulary" };
      if (
        scientificVocabulary.some(
          (v) =>
            v.caseSensitive &&
            v.term !== i.original &&
            v.term.toLowerCase() === i.original.toLowerCase(),
        )
      ) {
        return {
          issue: {
            ...i,
            category: "Scientific",
            replacements: [],
            terminologyStatus: "suspected-misspelling",
            explanation:
              "Possible scientific identifier case variant. Verify the intended identifier manually; no unrelated spelling substitution is offered.",
          },
        };
      }
      const candidate = technicalCandidate(i.original);
      if (candidate) {
        i.replacements = [candidate];
        i.terminologyStatus = "suspected-misspelling";
        i.explanation = `Possible misspelling of the curated scientific term “${candidate}”. Review in context.`;
      } else i.terminologyStatus = "unknown";
    }
    if (
      !i.notationOnly &&
      measurements.some(
        (r) =>
          contained(i, r) ||
          (i.start >= r.start &&
            i.end === r.end + 1 &&
            text.slice(r.end, i.end) === "."),
      ) &&
      (i.category === "Spelling" || i.rule.startsWith("Expand"))
    )
      return { reason: "measurement-token" };
    const protectedTokens = [
      ...known,
      ...variants,
      ...user,
      ...measurements.map((r) => ({ ...r, term: r.text })),
    ];
    const applicable = protectedTokens.filter((r) =>
      overlaps(i.start, i.end, r.start, r.end),
    );
    i.replacements = i.replacements.filter((replacement) => {
      if (
        numeric(i.original) !== numeric(replacement) ||
        caution(i.original) !== caution(replacement)
      )
        return false;
      if (i.notationOnly) return true;
      // A correction to surrounding grammar is allowed when every protected token remains intact.
      const result = text.slice(0, i.start) + replacement + text.slice(i.end);
      return applicable.every((r) => {
        const count = (source: string) => {
          const pattern = new RegExp(
            r.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gu",
          );
          let count = 0;
          for (const match of source.matchAll(pattern)) {
            const start = match.index!,
              end = start + match[0].length;
            if (
              !/[\p{L}\p{N}_]/u.test(source[start - 1] ?? "") &&
              !/[\p{L}\p{N}_]/u.test(source[end] ?? "")
            )
              ++count;
          }
          return count;
        };
        const before = count(text),
          after = count(result);
        return after >= before;
      });
    });
    if (
      input.replacements.length &&
      !i.replacements.length &&
      applicable.length &&
      (i.category === "Spelling" ||
        i.category === "Style" ||
        lexicalRules.has(i.rule))
    )
      return { reason: "protected-expression" };
    if (i.category === "Spelling" && identifiers.some((r) => contained(i, r))) {
      i.replacements = [];
      i.explanation =
        "Unrecognized identifier-like token. Verify the identifier manually; ProofLab cannot establish its scientific validity.";
    }
    return { issue: i };
  };
}
function priority(i: Issue) {
  return i.edits
    ? 1000
    : i.notationOnly
      ? i.rule === "Unit consistency"
        ? 910
        : 900
      : i.rule === "Bounded agreement" || i.rule === "Mass noun agreement"
        ? 850
        : i.rule === "Repeated words"
          ? 800
          : i.terminologyStatus === "suspected-misspelling"
            ? 750
            : i.category === "Spelling"
              ? 600
              : i.category === "Grammar"
                ? 550
                : 300;
}
/** Only merge a shared defect, not every intersecting span. Independent overlapping issues survive. */
export function aggregateIssues(issues: Issue[]): Issue[] {
  const ordered = [...issues].sort((a, b) => priority(b) - priority(a));
  const out: Issue[] = [];
  for (const candidate of ordered) {
    const conventionOwner = out.find(
      (i) =>
        ((i.notationOnly &&
          (candidate.rule === "DegreesKelvinSymbol" ||
            candidate.rule === i.rule)) ||
          (i.rule === "Repeated words" &&
            [
              "RepeatedWords",
              "RedundantThat",
              "ThatWhich",
              "SingleBe",
            ].includes(candidate.rule))) &&
        overlaps(i.start, i.end, candidate.start, candidate.end),
    );
    if (conventionOwner) {
      conventionOwner.sources = [
        ...new Set([
          ...(conventionOwner.sources ?? [conventionOwner.rule]),
          candidate.rule,
        ]),
      ];
      continue;
    }
    // A modal/base-verb diagnosis owns its auxiliary construction. Native
    // adjective/passive interpretations are mutually exclusive alternatives,
    // even when their smaller spans do not touch the lexical-verb edit.
    const modalOwner = out.find(
      (i) =>
        i.sources?.includes("Verb forms") &&
        candidate.start >= i.start &&
        candidate.end <= i.end &&
        (candidate.rule === "ModalBeAdjective" ||
          /^(?:Will|Would|Can|Could|May|Might|Must|Shall|Should)NonLemma$/.test(
            candidate.rule,
          )),
    );
    if (modalOwner) {
      modalOwner.sources = [
        ...new Set([
          ...(modalOwner.sources ?? [modalOwner.rule]),
          candidate.rule,
        ]),
      ];
      modalOwner.alternativesConflict ||= candidate.replacements.length > 0;
      continue;
    }
    const owner = out.find(
      (i) =>
        i.edits &&
        (lexicalRules.has(candidate.rule) ||
          candidate.category === "Grammar") &&
        i.edits.some(
          (e) =>
            candidate.start === e.start &&
            candidate.end === e.end &&
            (lexicalRules.has(candidate.rule) ||
              candidate.replacements.includes(e.replacement)),
        ),
    );
    if (owner) {
      owner.sources = [
        ...new Set([
          ...(owner.sources ?? [owner.rule]),
          ...(candidate.sources ?? [candidate.rule]),
        ]),
      ];
      continue;
    }
    const shared = out.find(
      (i) =>
        i.start === candidate.start &&
        i.end === candidate.end &&
        (i.category === candidate.category ||
          (lexicalRules.has(i.rule) && lexicalRules.has(candidate.rule)) ||
          i.replacements.some((r) => candidate.replacements.includes(r)) ||
          (lexicalRules.has(candidate.rule) && i.category === "Grammar")),
    );
    if (shared) {
      const contradictory =
        candidate.replacements.length > 0 &&
        shared.replacements.length > 0 &&
        !candidate.replacements.some((r) => shared.replacements.includes(r));
      shared.sources = [
        ...new Set([
          ...(shared.sources ?? [shared.rule]),
          ...(candidate.sources ?? [candidate.rule]),
        ]),
      ];
      shared.alternativesConflict =
        shared.alternativesConflict || contradictory;
      // Keep the higher-priority alternatives; do not mix incompatible meanings into a correction.
      continue;
    }
    out.push({ ...candidate, sources: candidate.sources ?? [candidate.rule] });
  }
  return out.sort((a, b) => a.start - b.start || priority(b) - priority(a));
}
