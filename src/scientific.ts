import { enabled, issue, type Issue, type Settings } from "./model";
import { repeatedWords } from "./repetition";
import { measurementIssues } from "./measurements";
export function scientific(
  text: string,
  s: Settings,
  words: string[],
): Issue[] {
  const out: Issue[] = [];
  const add = (
    r: string,
    m: RegExpMatchArray,
    replacements: string[],
    msg: string,
    cat: "Style" | "Scientific" | "Grammar" = "Scientific",
  ) => {
    if (enabled(r, s))
      out.push(
        issue(
          r,
          cat,
          m.index!,
          m.index! + m[0].length,
          text,
          replacements,
          msg,
        ),
      );
  };
  out.push(...repeatedWords(text, s), ...measurementIssues(text, s));
  for (const pair of [
    ["mL", "ml"],
    ["µg", "μg"],
  ])
    if (text.includes(pair[0]) && text.includes(pair[1]))
      for (const m of text.matchAll(new RegExp(`\\b${pair[1]}\\b`, "g")))
        add(
          "Unit consistency",
          m,
          [],
          `Both ${pair[0]} and ${pair[1]} occur. Check the journal’s notation requirements.`,
        );
  for (const word of words.filter((w) => /[A-Z]/.test(w)))
    for (const m of text.matchAll(/\b[A-Za-z][A-Za-z-]*\b/g))
      if (m[0] !== word && m[0].toLowerCase() === word.toLowerCase())
        add(
          "Abbreviation consistency",
          m,
          [],
          `The dictionary uses “${word}”. Review capitalization; identifiers are case-sensitive.`,
        );
  for (const [phrase, replacement] of [
    ["in order to", "to"],
    ["at this point in time", "now"],
    ["past history", "history"],
    ["completely unanimous", "unanimous"],
  ])
    for (const m of text.matchAll(new RegExp(`\\b${phrase}\\b`, "gi")))
      add(
        "Academic redundancy",
        m,
        [replacement],
        "A shorter expression may convey the same meaning. Review in context.",
        "Style",
      );
  for (const m of text.matchAll(/\b(?:proved that|proves that)\b/gi))
    add(
      "Terminology convention",
      m,
      [],
      "Manual review: verify that this wording matches the study design, evidence, and reporting requirements. ProofLab does not assess scientific validity.",
    );
  for (const sub of s.substitutions) {
    if (!sub.from || !sub.to) continue;
    let p = 0;
    while ((p = text.indexOf(sub.from, p)) !== -1) {
      const m = Object.assign([sub.from], { index: p }) as RegExpMatchArray;
      add(
        "Preferred terminology",
        m,
        [],
        `Your preferred wording is “${sub.to}”. Review and edit manually to preserve scientific meaning.`,
      );
      p += sub.from.length;
    }
  }
  return out;
}
