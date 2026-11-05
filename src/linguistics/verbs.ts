import { verb, modals, adverbs, type Token } from "./morphology";
import type { Subject } from "./subjects";
import type { TextEdit } from "../model";
export interface VerbFinding {
  edit: TextEdit;
  explanation: string;
}
const patients = new Set(
  "sample samples specimen specimens experiment experiments assay assays cell cells culture cultures tissue tissues extract extracts fraction fractions reagent reagents protein proteins aliquot aliquots solution solutions".split(
    " ",
  ),
);
const labPassive = new Set(
  "conduct repeat perform replicate analyze measure assess evaluate test store freeze keep preserve incubate treat wash stain image count prepare collect separate centrifuge expose send take".split(
    " ",
  ),
);
const human = new Set(
  "i we you they he she researcher researchers investigator investigators scientist scientists analyst analysts technician technicians team authors author".split(
    " ",
  ),
);
/** Auxiliary selection, not global tense normalization. Missing be complements
 * are ambiguous: an explicit object supports continuous for human agents;
 * passive repairs require a nonhuman patient, by-agent, or a passive chain. */
export function verbFindings(t: Token[], s: Subject): VerbFinding[] {
  const out: VerbFinding[] = [];
  let i = s.verbIndex;
  let previous = t[i].lower;
  const finding = (at: number, replacement: string, explanation: string) =>
    out.push({
      edit: {
        start: t[at].start,
        end: t[at].end,
        original: t[at].word,
        replacement,
      },
      explanation,
    });
  for (let depth = 0; depth < 5; depth++) {
    const prior = verb(previous);
    const modal = modals.has(previous);
    if (!modal && !["be", "have", "do"].includes(prior?.base ?? "")) break;
    let j = i + 1;
    while (adverbs.has(t[j]?.lower)) j++;
    if (!t[j]) break;
    const next = verb(t[j].lower);
    if (!next) break;
    let want: string | undefined;
    if (modal || prior?.base === "do") want = next.base;
    else if (prior?.base === "have") want = next.participle;
    else if (prior?.base === "be") {
      if ([next.participle, next.ing].includes(t[j].lower)) {
        i = j;
        previous = t[j].lower;
        continue;
      }
      if (next.base === "be") break;
      const hasObject =
        t[j + 1] &&
        ["the", "a", "an", "these", "those", "our"].includes(t[j + 1].lower);
      const passiveChain =
        ["been", "being"].includes(previous) && !human.has(s.head.lower);
      const by = t.slice(j + 1, j + 5).some((x) => x.lower === "by");
      if (human.has(s.head.lower) && hasObject) want = next.ing;
      else if (next.base === "complete")
        break; // “was complete” is a valid adjectival predicate.
      else if (
        (passiveChain ||
          by ||
          (patients.has(s.head.lower) && labPassive.has(next.base))) &&
        !hasObject
      )
        want = next.participle;
      else break;
    }
    if (want && want !== t[j].lower)
      finding(
        j,
        want,
        modal
          ? "A modal such as “may” requires the base verb; the uncertainty is preserved."
          : prior?.base === "do"
            ? "After do/does/did, use the base verb."
            : prior?.base === "have"
              ? "A perfect auxiliary requires the past participle."
              : want === next.ing
                ? "The ongoing action after “be” requires the -ing form."
                : "This passive auxiliary chain requires the past participle.",
      );
    i = j;
    previous = want ?? t[j].lower;
  }
  return out;
}
