import {
  enabled,
  issue,
  type Settings,
  type Issue,
  type TextEdit,
} from "../model";
import { tokenize, verb, type Token } from "./morphology";
import { subject } from "./subjects";
import { verbFindings } from "./verbs";
function clauses(text: string): Token[][] {
  const out: Token[][] = [];
  for (const sentence of new Intl.Segmenter("en", {
    granularity: "sentence",
  }).segment(text)) {
    for (const match of sentence.segment.matchAll(/[^\n]+/g)) {
      const ts = tokenize(match[0], sentence.index + match.index!);
      // Only explicit independent-clause conjunctions, not arbitrary commas.
      let start = 0;
      for (let i = 0; i < ts.length; i++)
        if (
          ts[i].word === ";" ||
          (ts[i].word === "," && ["and", "but"].includes(ts[i + 1]?.lower))
        ) {
          out.push(ts.slice(start, i));
          start = i + (ts[i].word === "," ? 2 : 1);
        }
      let rest = ts.slice(start);
      if (
        [
          "after",
          "before",
          "although",
          "when",
          "if",
          "while",
          "because",
        ].includes(rest[0]?.lower)
      ) {
        const comma = rest.findIndex((t) => t.word === ",");
        if (comma < 0) continue;
        rest = rest.slice(comma + 1);
      }
      out.push(rest);
    }
  }
  return out;
}
export function analyzeClauses(text: string, settings: Settings): Issue[] {
  const out: Issue[] = [];
  for (const t of clauses(text)) {
    const s = subject(t);
    if (!s) continue;
    const v = t[s.verbIndex],
      paradigm = verb(v.lower);
    const edits: TextEdit[] = [];
    const explanations: string[] = [];
    const sources: string[] = [];
    const add = (rule: string, edit: TextEdit, explanation: string) => {
      if (enabled(rule, settings)) {
        edits.push(edit);
        explanations.push(explanation);
        sources.push(rule);
      }
    };
    if (paradigm) {
      let want: string | undefined;
      const rule = s.existential
        ? "Existential agreement"
        : "Bounded agreement";
      if (paradigm.base === "be") {
        if (["was", "were"].includes(v.lower))
          want =
            s.number === "singular" && s.person !== "second" ? "was" : "were";
        else if (["is", "are", "am", "be"].includes(v.lower))
          want =
            s.person === "first"
              ? "am"
              : s.number === "singular"
                ? "is"
                : "are";
      } else if (
        [paradigm.base, paradigm.third].includes(v.lower) &&
        paradigm.past !== v.lower
      ) {
        want =
          s.number === "singular" && !s.person ? paradigm.third : paradigm.base;
      }
      if (want && want !== v.lower)
        add(
          rule,
          { start: v.start, end: v.end, original: v.word, replacement: want },
          `The head of the subject is “${s.head.word}”, which is ${s.number}. ${s.reason} Use “${want}” instead of “${v.word}”.`,
        );
    }
    for (const finding of verbFindings(t, s))
      add("Verb forms", finding.edit, finding.explanation);
    // Merge a governed preposition with agreement without a partially corrected card.
    for (let i = s.verbIndex; i < t.length - 2; i++)
      if (
        ["depend", "depends", "depended", "depending"].includes(t[i].lower) &&
        t[i + 1].lower === "of"
      )
        add(
          "Dependent preposition",
          {
            start: t[i + 1].start,
            end: t[i + 1].end,
            original: t[i + 1].word,
            replacement: "on",
          },
          "Forms of “depend” normally take “on”.",
        );
    if (edits.length) {
      const sorted = edits.sort((a, b) => a.start - b.start);
      const start = sources.includes("Dependent preposition")
          ? Math.min(v.start, sorted[0].start)
          : sorted[0].start,
        end = sorted.at(-1)!.end;
      let replacement = text.slice(start, end);
      for (const e of [...sorted].reverse())
        replacement =
          replacement.slice(0, e.start - start) +
          e.replacement +
          replacement.slice(e.end - start);
      const rule = sources[0];
      out.push({
        ...issue(
          rule,
          "Grammar",
          start,
          end,
          text,
          [replacement],
          explanations.join(" "),
        ),
        edits: sorted,
        sources: [...new Set(sources)],
        confidence: "high",
      });
    }
    if (
      enabled("Tense context review", settings) &&
      ["has", "have"].includes(v.lower)
    ) {
      const tail = text.slice(v.start, t.at(-1)!.end);
      if (
        /\b(?:yesterday|last (?:week|month|year|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)|in (?:19|20)\d{2}|(?:\d+|one|two|three|four|five|six|seven) days? ago)\b/i.test(
          tail,
        ) &&
        !/\b(?:since|until|by|before|after)\b/i.test(tail)
      )
        out.push({
          ...issue(
            "Tense context review",
            "Grammar",
            v.start,
            t.at(-1)!.end,
            text,
            [],
            "A completed event tied to a specific past time usually takes the simple past. Review the intended time reference; no tense rewrite is inferred.",
          ),
          confidence: "low",
        });
    }
  }
  return out;
}
