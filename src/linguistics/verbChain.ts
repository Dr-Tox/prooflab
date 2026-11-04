import { adverbs, modals, verb, type Token } from "./morphology";
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
    if (prior?.base === "have") perfect = true;
    if (prior?.base === "be") {
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
  };
}
