import { type Linter, Dialect, SuggestionKind } from "harper.js";
import {
  enabled,
  issue,
  type Category,
  type Settings,
  type Issue,
} from "./model";
import { scientific } from "./scientific";
import { grammar } from "./grammar";
import { createScientificPolicy, aggregateIssues } from "./policy";
import { contextual } from "./contextual";
import {
  validateSourceSpan,
  type EngineDiagnostics,
  type DiscardReason,
} from "./diagnostics";
export class Proofreader {
  private initial: Record<string, boolean | null> = {};
  private report?: EngineDiagnostics;
  private initialized = false;
  mappingFailureCount = 0;
  statistics = { fullAnalyses: 0, cacheHits: 0, configurationUpdates: 0 };
  private configuration?: string;
  private last?: {
    text: string;
    key: string;
    issues: Issue[];
    report?: EngineDiagnostics;
  };

  constructor(
    private linter: Linter,
    private options: { diagnostics?: boolean; cache?: boolean } = {},
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
  async analyze(
    text: string,
    settings: Settings,
    words: string[],
    revision = 0,
  ) {
    if (!this.initialized) throw Error("Proofreader is not initialized.");
    this.mappingFailureCount = 0;
    const key = JSON.stringify([settings, words]);
    if (
      this.options.cache !== false &&
      !this.options.diagnostics &&
      this.last?.text === text &&
      this.last.key === key
    ) {
      this.statistics.cacheHits++;
      this.report = this.last.report;
      return this.last.issues.map((i) => ({ ...i, revision }));
    }
    this.statistics.fullAnalyses++;
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
    const configuration = JSON.stringify([settings.dialect, config]);
    if (this.configuration !== configuration) {
      await this.linter.setDialect(
        settings.dialect === "UK" ? Dialect.British : Dialect.American,
      );
      await this.linter.setLintConfig(config);
      this.configuration = configuration;
      this.statistics.configurationUpdates++;
    }
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
    const policy = createScientificPolicy(text, words, settings.ignoredWords);
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
          const replacements = rawSuggestions.map((v) =>
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
      ...grammar(text, settings),
      ...contextual(text, settings),
      ...scientific(text, settings, words),
    ];
    const filtered: Issue[] = [];
    for (const candidate of [...custom, ...out]) {
      const decision = policy(candidate);
      if (decision.issue) filtered.push(decision.issue);
      else if (out.includes(candidate))
        discard(
          candidate.rule,
          candidate.start,
          candidate.end,
          decision.reason as DiscardReason,
        );
    }
    const combined = aggregateIssues(filtered).map((i) => ({ ...i, revision }));
    if (report) {
      const already = new Set(
        report.discardedLints.map((i) => `${i.rule}:${i.start}:${i.end}`),
      );
      for (const i of out) {
        if (
          !already.has(`${i.rule}:${i.start}:${i.end}`) &&
          !combined.some(
            (c) => c.rule === i.rule && c.start === i.start && c.end === i.end,
          )
        )
          discard(i.rule, i.start, i.end, "custom-rule-overlap");
      }
    }
    if (report) {
      report.acceptedLintCount =
        report.rawLintCount - report.discardedLints.length;
      report.customIssueCount = combined.filter((i) =>
        custom.some((c) => c.rule === i.rule),
      ).length;
      report.finalIssueCount = combined.length;
    }
    const resultCharacters =
      combined.length <= 1000
        ? combined.reduce(
            (n, i) =>
              n +
              i.original.length +
              i.explanation.length +
              i.replacements.reduce((a, r) => a + r.length, 0) +
              (i.edits?.reduce(
                (a, e) => a + e.original.length + e.replacement.length,
                0,
              ) ?? 0),
            0,
          )
        : Infinity;
    this.last =
      this.options.cache !== false &&
      !this.options.diagnostics &&
      resultCharacters <= 256000 &&
      text.length <= 128000 &&
      key.length <= 64000 &&
      combined.length <= 1000 &&
      (report?.rawLintCount ?? 0) <= 1000 &&
      this.mappingFailureCount === 0
        ? { text, key, issues: combined, report }
        : undefined;
    return combined;
  }
}
