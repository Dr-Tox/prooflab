import { enabled, issue, type Settings } from "./model";
export function legitimateRepetitions(text: string) {
  return [...text.matchAll(/\b([a-z]+)([ \t]+)\1\b/gi)]
    .filter((m) => {
      const word = m[1].toLowerCase();
      if (["that", "had", "do", "can", "will"].includes(word)) return true;
      const clause = text.slice(
        Math.max(
          text.lastIndexOf(".", m.index!),
          text.lastIndexOf("\n", m.index!),
        ) + 1,
        m.index!,
      );
      return (
        ["is", "was", "are", "were"].includes(word) &&
        /^\s*(?:what|whatever)\b/i.test(clause)
      );
    })
    .map((m) => [m.index!, m.index! + m[0].length] as [number, number]);
}
export function repeatedWords(text: string, s: Settings) {
  if (!enabled("Repeated words", s)) return [];
  const valid = legitimateRepetitions(text);
  return [...text.matchAll(/\b([a-z]+)([ \t]+)\1\b/gi)]
    .filter(
      (m) =>
        !valid.some(([a, b]) => a === m.index && b === m.index! + m[0].length),
    )
    .map((m) => {
      const direct = [
        "the",
        "a",
        "an",
        "of",
        "to",
        "and",
        "in",
        "for",
        "with",
        "was",
        "is",
        "were",
        "are",
      ].includes(m[1].toLowerCase());
      return {
        ...issue(
          "Repeated words",
          "Grammar",
          m.index!,
          m.index! + m[0].length,
          text,
          direct ? [m[1]] : [],
          direct
            ? "An adjacent function word appears to be duplicated. Review the intended construction."
            : "Possible repeated word. Repetition may be grammatical; review manually.",
        ),
        confidence: direct ? ("high" as const) : ("low" as const),
      };
    });
}
