import { type Linter, Dialect, SuggestionKind } from "harper.js";
import {
  enabled,
  issue,
  protectedRanges,
  overlaps,
  type Category,
  type Settings,
  type Issue,
} from "./model";
import { scientific } from "./scientific";
import { contextual } from "./contextual";
import {
  validateSourceSpan,
  type EngineDiagnostics,
  type DiscardReason,
} from "./diagnostics";
function acceptedTerm(
  text: string,
  start: number,
  end: number,
  terms: string[],
) {
  return terms.some((term) => {
    const from = text.lastIndexOf(term, start);
    if (from < 0 || from + term.length < end) return false;
    return (
      !/[\p{L}\p{N}_]/u.test(text[from - 1] ?? "") &&
      !/[\p{L}\p{N}_]/u.test(text[from + term.length] ?? "")
    );
  });
}
export class Proofreader {
  private initial: Record<string, boolean | null> = {};
  private report?: EngineDiagnostics;
  private initialized = false;
  mappingFailureCount = 0;
  constructor(
    private linter: Linter,
    private options: { diagnostics?: boolean } = {},
  ) {}
  getDiagnostics() {
    return this.report;
  }
  private emptyReport(): EngineDiagnostics {
    return {
      initializationStatus: "initializing",
      activeRules: [],
      rawLintCount: 0,
      acceptedLintCount: 0,
      customIssueCount: 0,
      finalIssueCount: 0,
      discardedLints: [],
      rawLints: [],
    };
  }
  async initialize() {
    if (this.options.diagnostics) this.report = this.emptyReport();
    try {
      await this.linter.setup();
      this.initial = await this.linter.getDefaultLintConfig();
      const rules = await this.linter.getLintDescriptions();
      this.initialized = true;
      if (this.report) {
        this.report.initializationStatus = "ready";
        this.report.activeRules = Object.keys(this.initial).filter(
          (k) => this.initial[k] === true,
        );
      }
      return { rules, config: this.initial };
    } catch (error) {
      if (this.report) this.report.initializationStatus = "failed";
      throw error;
    }
  }
  async analyze(text: string, settings: Settings, words: string[]) {
    if (!this.initialized) throw Error("Proofreader is not initialized.");
    this.mappingFailureCount = 0;
    const config = Object.fromEntries(
      Object.entries(this.initial).map(([k, v]) => [
        k,
        enabled(k, settings, v !== false),
      ]),
    );
    const report = this.options.diagnostics
      ? {
          ...this.emptyReport(),
          initializationStatus: "ready" as const,
          profile: settings.profile,
          dialect: settings.dialect,
          activeRules: Object.keys(config).filter((k) => config[k]),
        }
      : undefined;
    this.report = report;
    await this.linter.setDialect(
      settings.dialect === "UK" ? Dialect.British : Dialect.American,
    );
    await this.linter.setLintConfig(config);
    // Inspect actual applied rule states in development; defaults are not the same as unset/null states.
    if (report) {
      const applied = await this.linter.getLintConfig();
      report.activeRules = Object.keys(applied).filter(
        (k) => applied[k] === true,
      );
    }
    const organized = await this.linter.organizedLints(text, {
      language: "plaintext",
      dedup: false,
    });
    const out: Issue[] = [];
    const protectedSpans = protectedRanges(text);
    const discard = (
      rule: string,
      start: number,
      end: number,
      reason: DiscardReason,
    ) => report?.discardedLints.push({ rule, start, end, reason });
    for (const [rule, lints] of Object.entries(organized))
      for (const lint of lints) {
        try {
          const span = lint.span();
          const start = span.start,
            end = span.end;
          span.free();
          const original = lint.get_problem_text();
          const kind = lint.lint_kind();
          const suggestions = lint.suggestions();
          let rawSuggestions: { kind: number; replacement: string }[];
          try {
            rawSuggestions = suggestions.map((v) => ({
              kind: v.kind(),
              replacement: v.get_replacement_text(),
            }));
          } finally {
            suggestions.forEach((v) => v.free());
          }
          if (report) {
            ++report.rawLintCount;
            report.rawLints.push({
              rule,
              kind,
              start,
              end,
              problemText: original,
              sourceSlice: text.slice(start, end),
              suggestions: rawSuggestions,
              serialized: JSON.parse(lint.to_json()),
            });
          }
          const invalid = validateSourceSpan(text, start, end, original);
          if (invalid) {
            ++this.mappingFailureCount;
            discard(rule, start, end, invalid);
            continue;
          }
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
          if (category === "Spelling") {
            if (acceptedTerm(text, start, end, words)) {
              discard(rule, start, end, "dictionary-term");
              continue;
            }
            if (acceptedTerm(text, start, end, settings.ignoredWords)) {
              discard(rule, start, end, "ignored-word");
              continue;
            }
          }
          const protectedText = protectedSpans.some(([a, b]) =>
            overlaps(start, end, a, b),
          );
          if (category === "Spelling" && protectedText) {
            discard(rule, start, end, "protected-identifier");
            continue;
          }
          const replacements = protectedText
            ? []
            : rawSuggestions.map((v) =>
                v.kind === SuggestionKind.InsertAfter
                  ? original + v.replacement
                  : v.replacement,
              );
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
    const custom = [
      ...contextual(text, settings),
      ...scientific(text, settings, words),
    ];
    const accepted = out.filter((i) => {
      if (
        custom.some(
          (c) =>
            c.start === i.start && c.end === i.end && c.category === i.category,
        )
      ) {
        discard(i.rule, i.start, i.end, "custom-rule-overlap");
        return false;
      }
      return true;
    });
    const combined = [...custom, ...accepted].sort((a, b) => a.start - b.start);
    if (report) {
      report.acceptedLintCount = accepted.length;
      report.customIssueCount = custom.length;
      report.finalIssueCount = combined.length;
    }
    return combined;
  }
}
