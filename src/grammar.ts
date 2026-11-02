import {
  enabled,
  issue,
  type Settings,
  type Issue,
  type TextEdit,
} from "./model";
export const grammarRules: Record<string, string> = {
  "Bounded agreement":
    "Agreement for a lexically recognized subject head, including a bounded intervening prepositional phrase.",
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
const singular =
  "result sample compound effect assay concentration outcome measurement treatment control solution particle finding response signal culture size temperature dose instrument value observation method experiment cell group patient protein report cat dog reason limitation explanation";
const number = new Map<string, "singular" | "plural">();
for (const n of singular.split(" ")) {
  number.set(n, "singular");
  number.set(n + "s", "plural");
}
number.set("analysis", "singular");
number.set("analyses", "plural");
const adjectives = new Set(
  "clear small large observed clinical initial preliminary different current unexpected main primary secondary treated untreated measured final strong weak new old".split(
    " ",
  ),
);
const determiners = new Set(
  "the a an this that these those each every many several few all both".split(
    " ",
  ),
);
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
const mass: Record<string, string> = {
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
  const out: Issue[] = [];
  const add = (
    rule: string,
    start: number,
    end: number,
    replacements: string[],
    message: string,
  ) => {
    if (enabled(rule, s))
      out.push({
        ...issue(rule, "Grammar", start, end, text, replacements, message),
        confidence: replacements.length ? "high" : "low",
      } as Issue);
  };
  for (const { text: line, t } of sentenceTokens(text)) {
    while (t[0] && /^\p{Extended_Pictographic}$/u.test(t[0].word)) t.shift();
    if (!t.length) continue;
    // A deliberately bounded noun-phrase grammar. Unknown heads/coordination/clause crossings are not guessed.
    let h = 0;
    let subject: "singular" | "plural" | undefined;
    if (t[0].lower === "each" || t[0].lower === "every") {
      subject = "singular";
      h = 1;
      if (t[h]?.lower === "of") h++;
      if (determiners.has(t[h]?.lower)) h++;
    } else if (determiners.has(t[0].lower)) h++;
    for (let n = 0; n < 2 && adjectives.has(t[h]?.lower); n++) h++;
    if (number.has(t[h]?.lower)) {
      subject ??= number.get(t[h].lower);
      let v = h + 1;
      if (["of", "in", "with", "from"].includes(t[v]?.lower)) {
        v++;
        if (determiners.has(t[v]?.lower)) v++;
        for (let n = 0; n < 2 && adjectives.has(t[v]?.lower); n++) v++;
        if (number.has(t[v]?.lower)) v++;
        else v = -1;
      }
      if (v >= 0 && finite.has(t[v]?.lower)) {
        const pair = pairs.find((p) => p.includes(t[v].lower))!;
        const want = subject === "singular" ? pair[0] : pair[1];
        if (t[v].lower !== want)
          add(
            "Bounded agreement",
            t[v].start,
            t[v].end,
            [want],
            `The subject head “${t[h].word}” takes ${subject} agreement here. Intervening nouns do not determine this verb's number.`,
          );
      }
    }
    if (
      t[0].lower === "there" &&
      ["is", "was"].includes(t[1]?.lower) &&
      ["many", "several", "few", "both"].includes(t[2]?.lower) &&
      number.get(t[3]?.lower) === "plural"
    )
      add(
        "Existential agreement",
        t[1].start,
        t[1].end,
        [t[1].lower === "is" ? "are" : "were"],
        "This existential construction introduces an explicitly plural noun phrase.",
      );
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
