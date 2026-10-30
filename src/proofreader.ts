import { type Linter, Dialect, SuggestionKind } from "harper.js";
import {
  enabled,
  issue,
  protectedRanges,
  overlaps,
  type Category,
  type Settings,
} from "./model";
import { scientific } from "./scientific";
function acceptedTerm(
  text: string,
  start: number,
  end: number,
  terms: string[],
) {
  return terms.some((term) => {
    const from = text.lastIndexOf(term, start);
    if (from < 0 || from + term.length < end) return false;
    // Whole-term matches only; do not accept a dictionary word inside another word.
    return (
      !/[\p{L}\p{N}_]/u.test(text[from - 1] ?? "") &&
      !/[\p{L}\p{N}_]/u.test(text[from + term.length] ?? "")
    );
  });
}
export class Proofreader {
  private initial: Record<string, boolean | null> = {};
  constructor(private linter: Linter) {}
  async initialize() {
    await this.linter.setup();
    this.initial = await this.linter.getDefaultLintConfig();
    return {
      rules: await this.linter.getLintDescriptions(),
      config: this.initial,
    };
  }
  async analyze(text: string, settings: Settings, words: string[]) {
    const s = settings;
    await this.linter.setDialect(
      s.dialect === "UK" ? Dialect.British : Dialect.American,
    );
    await this.linter.setLintConfig(
      Object.fromEntries(
        Object.entries(this.initial).map(([k, v]) => [
          k,
          enabled(k, s, v !== false),
        ]),
      ),
    );
    // Case-sensitive dictionary filtering avoids Harper's case-folding user dictionary.
    const organized = await this.linter.organizedLints(text, {
      language: "plaintext",
      dedup: false,
    });
    const out = [];
    const protectedSpans = protectedRanges(text);
    for (const [rule, lints] of Object.entries(organized))
      for (const lint of lints) {
        try {
          const span = lint.span();
          const start = span.start,
            end = span.end;
          span.free();
          const original = lint.get_problem_text();
          if (
            start === undefined ||
            end === undefined ||
            text.slice(start, end) !== original
          )
            continue;
          const kind = lint.lint_kind();
          const category: Category =
            kind === "Spelling"
              ? "Spelling"
              : kind === "Punctuation"
                ? "Punctuation"
                : [
                      "Style",
                      "Readability",
                      "Redundancy",
                      "Enhancement",
                    ].includes(kind)
                  ? "Style"
                  : "Grammar";
          if (
            category === "Spelling" &&
            acceptedTerm(text, start, end, [...words, ...s.ignoredWords])
          )
            continue;
          const protectedText = protectedSpans.some(([a, b]) =>
            overlaps(start, end, a, b),
          );
          const suggestions = lint.suggestions();
          const replacements = protectedText
            ? []
            : suggestions.map((v) =>
                v.kind() === SuggestionKind.InsertAfter
                  ? original + v.get_replacement_text()
                  : v.get_replacement_text(),
              );
          suggestions.forEach((v) => v.free());
          if (category === "Spelling" && protectedText) continue;
          out.push(
            issue(
              rule,
              category,
              start,
              end,
              text,
              [...new Set(replacements)],
              lint.message(),
            ),
          );
        } finally {
          lint.free();
        }
      }
    const custom = scientific(text, s, words);
    const combined = [
      ...custom,
      ...out.filter(
        (i) =>
          !custom.some(
            (c) =>
              c.start === i.start &&
              c.end === i.end &&
              c.category === i.category,
          ),
      ),
    ].sort((a, b) => a.start - b.start);
    return combined;
  }
}
