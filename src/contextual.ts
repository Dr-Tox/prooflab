import { enabled, issue, type Settings } from "./model";
/** Narrow manual review, not a contextual spellchecker or a possessive parser. */
export function contextual(text: string, settings: Settings) {
  if (!enabled("Time expression review", settings)) return [];
  return [...text.matchAll(/\blast[ \t]+nigh\b(?![ \t]+(?:unto|on)\b)/gi)].map(
    (m) =>
      issue(
        "Time expression review",
        "Style",
        m.index!,
        m.index! + m[0].length,
        text,
        [],
        "In this time expression, check whether you meant “last night”. “Nigh” is also a valid word meaning “near”; review the context and edit manually.",
      ),
  );
}
