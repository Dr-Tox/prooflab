import { analyzeClauses } from "./linguistics/analyze";
import {
  enabled,
  issue,
  type Settings,
  type Issue,
  type TextEdit,
} from "./model";
export const grammarRules: Record<string, string> = {
  "Verb forms":
    "Auxiliary-selected base, participle, and continuous forms, including coordinated agreement repairs.",
  "Tense context review":
    "Review present-perfect constructions with an explicit completed past-time reference; never normalize an entire document’s tense.",
  "Bounded agreement":
    "Subject-head agreement across bounded prepositional phrases and passive subject relatives.",
  "Existential agreement":
    "There is/was before an explicitly plural quantified noun.",
  "Dependent preposition": "Forms of depend govern on, not of.",
  "It contraction":
    "Its followed by an adjective and to/that may require It’s.",
  "Mass noun agreement":
    "Coordinate demonstrative, mass noun, and copula changes in one transaction.",
  "Sentence structure review":
    "Conservative warnings for selected possible run-ons, comma splices, subordinate fragments, and unclear modifier agency.",
};
interface Token {
  word: string;
  start: number;
  end: number;
  lower: string;
}
export function tokens(text: string): Token[] {
  return [
    ...text.matchAll(/[\p{L}\p{M}]+(?:['’][\p{L}]+)?|\d+|[^\s\p{L}\p{M}\d]/gu),
  ].map((m) => ({
    word: m[0],
    lower: m[0].toLowerCase(),
    start: m.index!,
    end: m.index! + m[0].length,
  }));
}
const pairs = [
  ["is", "are"],
  ["was", "were"],
  ["has", "have"],
  ["does", "do"],
  ["shows", "show"],
  ["indicates", "indicate"],
  ["suggests", "suggest"],
  ["depends", "depend"],
  ["requires", "require"],
  ["contains", "contain"],
  ["provides", "provide"],
  ["yields", "yield"],
  ["remains", "remain"],
  ["appears", "appear"],
  ["demonstrates", "demonstrate"],
  ["affects", "affect"],
  ["increases", "increase"],
  ["reduces", "reduce"],
];
const finite = new Set(pairs.flat());
export const mass: Record<string, string> = {
  informations: "information",
  equipments: "equipment",
  advices: "advice",
  evidences: "evidence",
};
function sentenceTokens(text: string) {
  const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
  return [...segmenter.segment(text)]
    .flatMap((s) =>
      s.segment
        .split(/\n/)
        .reduce<{ text: string; offset: number }[]>((out, line) => {
          out.push({
            text: line,
            offset: s.index + out.reduce((n, l) => n + l.text.length + 1, 0),
          });
          return out;
        }, []),
    )
    .map((s) => ({
      text: s.text,
      t: tokens(s.text).map((t) => ({
        ...t,
        start: t.start + s.offset,
        end: t.end + s.offset,
      })),
    }));
}
export function grammar(text: string, s: Settings): Issue[] {
  const out: Issue[] = analyzeClauses(text, s);
  const add = (
    rule: string,
    start: number,
    end: number,
    replacements: string[],
    message: string,
  ) => {
    if (
      enabled(rule, s) &&
      !out.some(
        (i) => i.sources?.includes(rule) && i.start <= start && i.end >= end,
      )
    )
      out.push({
        ...issue(rule, "Grammar", start, end, text, replacements, message),
        confidence: replacements.length ? "high" : "low",
      } as Issue);
  };
  for (const { text: line, t } of sentenceTokens(text)) {
    while (t[0] && /^\p{Extended_Pictographic}$/u.test(t[0].word)) t.shift();
    if (!t.length) continue;
    for (let i = 0; i < t.length - 2; i++) {
      if (
        ["depend", "depends", "depended", "depending"].includes(t[i].lower) &&
        t[i + 1].lower === "of" &&
        /^[\p{L}]/u.test(t[i + 2].word)
      )
        add(
          "Dependent preposition",
          t[i].start,
          t[i + 1].end,
          [text.slice(t[i].start, t[i + 1].start) + "on"],
          "Forms of “depend” normally take the preposition “on”.",
        );
    }
    if (
      t[0].lower === "its" &&
      [
        "important",
        "necessary",
        "essential",
        "possible",
        "useful",
        "clear",
        "likely",
        "reasonable",
      ].includes(t[1]?.lower) &&
      ["to", "that"].includes(t[2]?.lower)
    )
      add(
        "It contraction",
        t[0].start,
        t[0].end,
        [t[0].word[0] === "I" ? "It’s" : "it’s"],
        "This construction needs “it is” (“it’s”), rather than possessive “its”.",
      );
    if (
      ["these", "those"].includes(t[0].lower) &&
      mass[t[1]?.lower] &&
      ["are", "were"].includes(t[2]?.lower) &&
      enabled("Mass noun agreement", s)
    ) {
      const replacement = [
        t[0].lower === "these" ? "this" : "that",
        mass[t[1].lower],
        t[2].lower === "are" ? "is" : "was",
      ];
      if (/^[A-Z]/.test(t[0].word))
        replacement[0] =
          replacement[0][0].toUpperCase() + replacement[0].slice(1);
      const edits: TextEdit[] = t.slice(0, 3).map((tok, i) => ({
        start: tok.start,
        end: tok.end,
        original: tok.word,
        replacement: replacement[i],
      }));
      const original = text.slice(t[0].start, t[2].end);
      let fixed = original;
      for (const edit of [...edits].reverse())
        fixed =
          fixed.slice(0, edit.start - t[0].start) +
          edit.replacement +
          fixed.slice(edit.end - t[0].start);
      out.push({
        ...issue(
          "Mass noun agreement",
          "Grammar",
          t[0].start,
          t[2].end,
          text,
          [fixed],
          "Use a singular demonstrative, mass noun, and verb together. All three edits form one atomic correction.",
        ),
        edits,
        confidence: "high",
      });
    }
    if (
      !enabled("Sentence structure review", s) ||
      !/[.!?]\s*$/.test(line) ||
      /^\s*(?:[-*•]|\d+\.)/.test(line)
    )
      continue;
    const comma = t.findIndex((x) => x.word === ",");
    if (
      ["although", "though", "because", "unless", "while"].includes(
        t[0].lower,
      ) &&
      comma < 0 &&
      t.some((x) => finite.has(x.lower))
    )
      add(
        "Sentence structure review",
        t[0].start,
        t[t.length - 1].end,
        [],
        "Potential subordinate-clause fragment. A heading or deliberate fragment may be intentional; review whether a main clause is needed.",
      );
    const pronouns = new Set(["they", "it", "he", "she", "we"]);
    for (let i = 2; i < t.length - 1; i++)
      if (
        pronouns.has(t[i].lower) &&
        [
          "were",
          "was",
          "are",
          "is",
          "did",
          "does",
          "do",
          "have",
          "has",
        ].includes(t[i + 1].lower)
      ) {
        const prefix = t.slice(0, i);
        if (
          !prefix.some((x) =>
            [
              "were",
              "was",
              "are",
              "is",
              "reduced",
              "increased",
              "improved",
              "analyzed",
              "frozen",
            ].includes(x.lower),
          )
        )
          continue;
        if (
          [
            "although",
            "though",
            "because",
            "unless",
            "while",
            "after",
            "before",
            "when",
            "if",
          ].includes(t[0].lower)
        )
          continue;
        if (
          prefix.some((x) => ["and", "but", "or", ";", ":"].includes(x.lower))
        )
          continue;
        add(
          "Sentence structure review",
          t[i - 1].start,
          t[i + 1].end,
          [],
          t[i - 1].word === ","
            ? "Potential comma splice between independent clauses. Review punctuation or conjunctions without changing the scientific claim."
            : "Potential missing clause boundary. Review whether punctuation or a conjunction is needed; no rewrite is inferred.",
        );
      }
    if (
      ["after", "before"].includes(t[0].lower) &&
      ["centrifuging", "washing", "staining", "heating", "mixing"].includes(
        t[1]?.lower,
      ) &&
      comma > 1
    ) {
      let a = comma + 1;
      if (t[a]?.lower === "the") a++;
      if (
        ["microscope", "spectrometer", "instrument", "centrifuge"].includes(
          t[a]?.lower,
        )
      )
        add(
          "Sentence structure review",
          t[0].start,
          t[a].end,
          [],
          "Potentially unclear modifier agency: check who performed the introductory action and how it relates to this equipment. Passive laboratory descriptions can be intentional; review manually.",
        );
    }
  }
  return out;
}
