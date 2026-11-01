/** Session-only diagnostics. The worker enables capture/logging only in Vite development mode. */
export type InitializationStatus =
  "not-started" | "initializing" | "ready" | "failed";
export type DiscardReason =
  | "invalid-span"
  | "source-mismatch"
  | "dictionary-term"
  | "ignored-word"
  | "protected-identifier"
  | "custom-rule-overlap";
export interface RawLint {
  rule: string;
  kind: string;
  start: number;
  end: number;
  problemText: string;
  sourceSlice: string;
  suggestions: { kind: number; replacement: string }[];
  serialized: unknown;
}
export interface DiscardedLint {
  rule: string;
  start: number;
  end: number;
  reason: DiscardReason;
}
export interface EngineDiagnostics {
  initializationStatus: InitializationStatus;
  profile?: string;
  dialect?: string;
  activeRules: string[];
  rawLintCount: number;
  acceptedLintCount: number;
  customIssueCount: number;
  finalIssueCount: number;
  discardedLints: DiscardedLint[];
  rawLints: RawLint[];
}
/** Harper 3.0.0 span() already uses UTF-16 end-exclusive indices, as String.slice does. */
export function validateSourceSpan(
  text: string,
  start: number,
  end: number,
  problemText: string,
): "invalid-span" | "source-mismatch" | undefined {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    end > text.length
  )
    return "invalid-span";
  // Do not search for another occurrence or normalize the text: that could correct the wrong range.
  if (text.slice(start, end) !== problemText) return "source-mismatch";
}
