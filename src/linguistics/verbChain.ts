import {
  adverbs,
  modals,
  verb,
  nounNumber,
  determiners,
  prepositions,
  type Token,
} from "./morphology";
export const stativeVerbs = new Set(["know", "belong", "consist", "resemble"]);
export interface VerbChain {
  start: number;
  end: number;
  tokenIndex: number;
  lastIndex: number;
  tense: "present" | "past" | "future" | "modal";
  perfect: boolean;
  progressive: boolean;
  passive: boolean;
  modal?: string;
  lexical?: string;
  ambiguousAuxiliary: boolean;
  lexicalHave: boolean;
}
/** Describe observed forms; never choose a new time or voice for the author. */
export function verbChain(t: Token[], index: number): VerbChain | undefined {
  const first = t[index];
  if (!first) return;
  const initial = verb(first.lower),
    modal = modals.has(first.lower);
  if (!initial && !modal) return;
  const tense = modal
    ? ["will", "shall"].includes(first.lower)
      ? "future"
      : "modal"
    : ["was", "were", "had", "did"].includes(first.lower) ||
        initial?.past === first.lower
      ? "past"
      : "present";
  let perfect = false,
    progressive = false,
    passive = false,
    ambiguousAuxiliary = false,
    lexicalHave = false,
    last = index,
    previous = first.lower,
    lexical = initial?.base;
  for (let depth = 0; depth < 6; depth++) {
    const prior = verb(previous);
    if (
      !modals.has(previous) &&
      !["be", "have", "do"].includes(prior?.base ?? "")
    )
      break;
    let j = last + 1;
    while (adverbs.has(t[j]?.lower)) j++;
    const next = verb(t[j]?.lower ?? "");
    if (!next) break;
    if (prior?.base === "have" && t[j].lower === next.ing) {
      ambiguousAuxiliary = true;
      const head = t[j + 1];
      // “have monitoring data / measuring equipment” can be possession of an
      // NP, not an incomplete auxiliary. Undergo has no such attributive use.
      if (
        head &&
        !["undergo", "be"].includes(next.base) &&
        !determiners.has(head.lower) &&
        !prepositions.has(head.lower) &&
        !adverbs.has(head.lower) &&
        nounNumber(head.word)
      ) {
        lexicalHave = true;
        break;
      }
    }
    if (prior?.base === "have") perfect = true;
    if (prior?.base === "be") {
      if (
        stativeVerbs.has(next.base) &&
        ![next.participle, next.ing].includes(t[j].lower)
      )
        ambiguousAuxiliary = true;
      if (t[j].lower === next.ing) progressive = true;
      else if (t[j].lower === next.participle && next.base !== "be")
        passive = true;
      if (t[j].lower === "been") ambiguousAuxiliary = true;
    }
    if (prior?.base === "have" && t[j].lower === next.ing)
      ambiguousAuxiliary = true;
    previous = t[j].lower;
    lexical = next.base;
    last = j;
  }
  return {
    start: first.start,
    end: t[last].end,
    tokenIndex: index,
    lastIndex: last,
    tense,
    perfect,
    progressive,
    passive,
    modal: modal ? first.lower : undefined,
    lexical,
    ambiguousAuxiliary,
    lexicalHave,
  };
}
