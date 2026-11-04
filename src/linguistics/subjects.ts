import {
  type Token,
  type NumberValue,
  nounNumber,
  finiteCandidate,
  verb,
  prepositions,
  determiners,
  adverbs,
} from "./morphology";
export interface Subject {
  head: Token;
  number: NumberValue;
  verbIndex: number;
  reason: string;
  person?: "first" | "second";
  existential?: boolean;
}
const pronouns: Record<string, NumberValue> = {
  we: "plural",
  they: "plural",
  you: "plural",
  i: "singular",
  he: "singular",
  she: "singular",
  it: "singular",
  everyone: "singular",
  everybody: "singular",
  someone: "singular",
  somebody: "singular",
  anyone: "singular",
  anybody: "singular",
  nobody: "singular",
  nothing: "singular",
  everything: "singular",
  both: "plural",
};
/** Parse a bounded subject NP rather than selecting the nearest noun.
 * PP objects never replace its head. Subject-relative passive clauses are
 * crossed only after a complete auxiliary + participle chain. Object relatives,
 * disjunction, appositives and unrecognized predicates deliberately abstain. */
export function subject(t: Token[]): Subject | undefined {
  if (t.length < 2) return;
  let start = 0;
  while (t[start] && /^\p{Extended_Pictographic}$/u.test(t[start].word))
    start++;
  while (adverbs.has(t[start]?.lower)) start++;
  const existential = t[start]?.lower === "there";
  if (existential) {
    const v = start + 1;
    if (!["is", "are", "was", "were"].includes(t[v]?.lower)) return;
    let end = v + 1;
    while (t[end] && !/[.!?;,]/.test(t[end].word)) end++;
    const np = t.slice(v + 1, end);
    const pp = np.findIndex((x) => prepositions.has(x.lower));
    if (pp >= 0) np.splice(pp);
    if (np.some((x) => verb(x.lower))) return;
    const head = np
      .filter((x) => !determiners.has(x.lower) && !adverbs.has(x.lower))
      .at(-1);
    if (!head) return;
    const number = nounNumber(head.word);
    if (number)
      return {
        head,
        number,
        verbIndex: v,
        reason: "The noun phrase introduced by “there” controls agreement.",
        existential: true,
      };
    return;
  }
  let head: Token | undefined;
  let number: NumberValue | undefined;
  let inPP = false;
  let coordinated = false;
  let quantified = false;
  const initial = t[start]?.lower;
  if (pronouns[initial]) {
    head = t[start];
    number = pronouns[initial];
  }
  if (["each", "every", "either", "neither"].includes(initial)) {
    head = t[start];
    number = "singular";
    quantified = true;
  }
  for (let i = start + (head ? 1 : 0); i < t.length; i++) {
    const tok = t[i],
      w = tok.lower;
    if (
      [
        "to",
        "its",
        "as",
        "along",
        "together",
        "except",
        "including",
        "excluding",
      ].includes(w)
    )
      return;
    if (/[.!?;,:]/.test(tok.word)) return;
    if (["or", "nor", "whose", "whom", "which"].includes(w)) return;
    if (w === "that" || w === "who") {
      if (!head || i === start) {
        if (i === start) continue;
        return;
      }
      // Only subject-relative passive/continuous chains, never arbitrary clauses.
      let j = i + 1;
      if (
        !["was", "were", "is", "are", "has", "have", "had"].includes(
          t[j]?.lower,
        )
      )
        return;
      j++;
      while (adverbs.has(t[j]?.lower)) j++;
      if (t[j]?.lower === "been") {
        j++;
        while (adverbs.has(t[j]?.lower)) j++;
      }
      const relative = verb(t[j]?.lower ?? "");
      if (
        !relative ||
        ![relative.participle, relative.ing].includes(t[j].lower)
      )
        return;
      i = j;
      inPP = false;
      continue;
    }
    // An unrecognized adverb/participial modifier must not replace the subject
    // head (“results unexpectedly/combined show”). Prefer abstention to a
    // fabricated singular head; recognized finite verbs still reach analysis.
    if (
      head &&
      !inPP &&
      /(?:ly|ed|ing)$/.test(w) &&
      !verb(w) &&
      !adverbs.has(w)
    )
      return;
    if (w === "overall") continue;
    if (finiteCandidate(tok) && head) {
      // Ambiguous noun/verb (e.g. “negative control was”, “records were”):
      // a following finite auxiliary supplies the predicate boundary.
      if (
        verb(w) &&
        !["be", "have", "do"].includes(verb(w)!.base) &&
        ["is", "are", "was", "were", "has", "have", "had"].includes(
          t[i + 1]?.lower,
        )
      ) {
        if (!inPP && !quantified && (!pronouns[initial] || coordinated))
          head = tok;
        continue;
      }
      if (
        inPP &&
        (prepositions.has(t[i - 1]?.lower) ||
          determiners.has(t[i - 1]?.lower) ||
          ["is", "are", "was", "were", "has", "have", "had"].includes(
            t[i + 1]?.lower,
          ))
      )
        continue;
      // A lexical base/participle before a noun may be an attributive modifier.
      const v = verb(w);
      if (
        v &&
        v.base !== "be" &&
        v.base !== "have" &&
        v.base !== "do" &&
        w === v.past &&
        t[i + 1] &&
        !verb(t[i + 1].lower) &&
        !prepositions.has(t[i + 1].lower) &&
        !/[.!?;,]/.test(t[i + 1].word) &&
        !adverbs.has(t[i + 1].lower)
      )
        continue;
      let n = number ?? nounNumber(head.word);
      if (head.lower === "series" && ["a", "the"].includes(initial))
        n = "singular";
      if (head.lower === "number")
        n =
          initial === "a"
            ? "plural"
            : initial === "the"
              ? "singular"
              : undefined;
      if (coordinated) n = "plural";
      if (!n) return;
      // Pronoun I uses base present but singular past; caller handles it.
      return {
        head,
        number: n,
        verbIndex: i,
        person:
          initial === "i" ? "first" : initial === "you" ? "second" : undefined,
        reason: coordinated
          ? "Subjects joined by “and” take plural agreement."
          : head.lower === "number" && initial === "a"
            ? "‘A number of’ refers to multiple items and takes plural agreement."
            : quantified
              ? "“Each/every” controls singular agreement."
              : "Nouns in intervening phrases do not control this verb.",
      };
    }
    if (w === "and") {
      if (inPP) return; // Coordination inside PP is not assumed to coordinate subjects.
      coordinated = true;
      head = undefined;
      number = undefined;
      continue;
    }
    if (prepositions.has(w)) {
      if (!head) return;
      inPP = true;
      continue;
    }
    if (determiners.has(w) || adverbs.has(w)) continue;
    if (!/^[\p{L}\p{M}]/u.test(tok.word)) return;
    if (!inPP && !quantified && (!pronouns[initial] || coordinated)) {
      head = tok;
      number = undefined;
    }
  }
}
