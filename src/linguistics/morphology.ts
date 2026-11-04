/** Small original deterministic morphology, not a probabilistic parser.
 * Noun number uses productive morphology; the verb lexicon disambiguates lexical
 * verbs from nouns. Unknown or ambiguous constructions must abstain. */
export type NumberValue = "singular" | "plural";
export interface Token {
  word: string;
  lower: string;
  start: number;
  end: number;
}
export function tokenize(text: string, offset = 0): Token[] {
  return [
    ...text.matchAll(
      /[\p{L}\p{M}][\p{L}\p{M}\p{N}]*(?:[-‐‑][\p{L}\p{M}\p{N}]+)*(?:['’][\p{L}]+)?|\d+(?:\.\d+)?|[^\s]/gu,
    ),
  ].map((m) => ({
    word: m[0],
    lower: m[0].toLowerCase(),
    start: offset + m.index!,
    end: offset + m.index! + m[0].length,
  }));
}
const plurals = new Set(
  "data bacteria media criteria phenomena analyses hypotheses matrices nuclei indices people children mice men women teeth feet geese oxen".split(
    " ",
  ),
);
const singulars = new Set(
  "analysis hypothesis phenomenon criterion index matrix nucleus bacterium medium person child mouse man woman tooth foot goose ox evidence information equipment apparatus news physics mathematics species series".split(
    " ",
  ),
);
const invariant = new Set("species series sheep fish means".split(" "));
export function nounNumber(word: string): NumberValue | undefined {
  const w = word.toLowerCase();
  if (invariant.has(w)) return undefined;
  if (plurals.has(w)) return "plural";
  if (singulars.has(w)) return "singular";
  if (word === "PFAS") return "plural";
  if (!/^[a-z]+$/i.test(word) || /^[A-Z]{2,}$/.test(word)) return undefined;
  if (/(?:ss|us|is)$/.test(w)) return "singular";
  return /s$/.test(w) ? "plural" : "singular";
}
export interface Verb {
  base: string;
  third: string;
  past: string;
  participle: string;
  ing: string;
}
export const verbs: Verb[] = [];
const regular =
  "show indicate suggest depend require contain provide yield remain appear demonstrate affect increase reduce conduct analyze measure assess evaluate test repeat perform complete replicate store preserve incubate identify treat wash stain image count accept agree dispute confirm report examine monitor study observe record persist aggregate accumulate degrade reveal detect predict underestimate explain describe elucidate investigate collect exclude include prepare calibrate produce express regulate modulate promote bind separate centrifuge freeze control use discuss improve damage determine compare vary carry apply quantify expose recover obtain process consider cause support reflect associate divide work".split(
    " ",
  );
function regularForms(base: string): Verb {
  const third = /[^aeiou]y$/.test(base)
    ? base.slice(0, -1) + "ies"
    : /(?:s|sh|ch|x|z|o)$/.test(base)
      ? base + "es"
      : base + "s";
  const past = base.endsWith("e")
    ? base + "d"
    : /[^aeiou]y$/.test(base)
      ? base.slice(0, -1) + "ied"
      : base + "ed";
  const ing =
    base.endsWith("e") && !base.endsWith("ee")
      ? base.slice(0, -1) + "ing"
      : base + "ing";
  return { base, third, past, participle: past, ing };
}
for (const base of regular) verbs.push(regularForms(base));
for (const row of [
  "control,controls,controlled,controlled,controlling",
  "be,is,was,been,being",
  "have,has,had,had,having",
  "do,does,did,done,doing",
  "undergo,undergoes,underwent,undergone,undergoing",
  "write,writes,wrote,written,writing",
  "take,takes,took,taken,taking",
  "see,sees,saw,seen,seeing",
  "choose,chooses,chose,chosen,choosing",
  "give,gives,gave,given,giving",
  "find,finds,found,found,finding",
  "keep,keeps,kept,kept,keeping",
  "send,sends,sent,sent,sending",
  "begin,begins,began,begun,beginning",
  "run,runs,ran,run,running",
  "freeze,freezes,froze,frozen,freezing",
  "bind,binds,bound,bound,binding",
  "grow,grows,grew,grown,growing",
  "lead,leads,led,led,leading",
]) {
  const [base, third, past, participle, ing] = row.split(",");
  const old = verbs.findIndex((v) => v.base === base);
  if (old >= 0) verbs.splice(old, 1);
  verbs.push({ base, third, past, participle, ing });
}
const forms = new Map<string, Verb>();
for (const v of verbs) for (const form of Object.values(v)) forms.set(form, v);
for (const f of ["are", "were", "am"])
  forms.set(
    f,
    verbs.find((v) => v.base === "be")!,
  );
export const verb = (w: string) => forms.get(w.toLowerCase());
export const modals = new Set(
  "may might can could shall should will would must".split(" "),
);
export const adverbs = new Set(
  "not never already recently previously independently carefully repeatedly always often sometimes usually also still just now significantly".split(
    " ",
  ),
);
export const prepositions = new Set(
  "of in with from on at for by near under within between among without against through".split(
    " ",
  ),
);
export const determiners = new Set(
  "the a an this that these those each every many several few all both some any no neither either".split(
    " ",
  ),
);
export function finiteCandidate(t: Token) {
  const v = verb(t.lower);
  return (
    modals.has(t.lower) ||
    (!!v && [v.base, v.third, v.past, "are", "were", "am"].includes(t.lower))
  );
}
