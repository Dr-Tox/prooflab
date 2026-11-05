import type { EngineDiagnostics, InitializationStatus } from "./diagnostics";
export function EngineDiagnosticsPanel({
  report,
  initializationStatus,
  busy,
  error,
  visibleCount,
}: {
  report?: EngineDiagnostics;
  initializationStatus: InitializationStatus;
  busy: boolean;
  error: string;
  visibleCount: number;
}) {
  return (
    <details
      className="card diagnostics-panel"
      open
      aria-label="Engine diagnostics"
    >
      <summary>Engine diagnostics · development only</summary>
      <p>
        Local session and browser console only. Raw lints can contain text
        excerpts. Nothing is saved or transmitted by this panel.
      </p>
      <dl>
        <dt>Initialization status</dt>
        <dd data-testid="engine-initialization">{initializationStatus}</dd>
        <dt>Analysis status</dt>
        <dd data-testid="analysis-status">
          {error ? "failed" : busy ? "checking" : "complete"}
        </dd>
        <dt>Profile / dialect</dt>
        <dd>
          {report?.profile ?? "—"} / {report?.dialect ?? "—"}
        </dd>
        <dt>Active Harper rules</dt>
        <dd data-testid="active-rule-count">
          {report?.activeRules.length ?? "—"}
        </dd>
        <dt>Raw lint count</dt>
        <dd data-testid="raw-lint-count">{report?.rawLintCount ?? "—"}</dd>
        <dt>Accepted lint count (Harper)</dt>
        <dd data-testid="accepted-lint-count">
          {report?.acceptedLintCount ?? "—"}
        </dd>
        <dt>Custom issue count</dt>
        <dd data-testid="custom-issue-count">
          {report?.customIssueCount ?? "—"}
        </dd>
        <dt>Final engine issue count</dt>
        <dd>{report?.finalIssueCount ?? "—"}</dd>
        <dt>Visible issue count (after filters / dismissal)</dt>
        <dd>{visibleCount}</dd>
      </dl>
      {error && <p role="alert">{error}</p>}
      <details>
        <summary>Active rule identifiers</summary>
        <pre data-testid="active-rules">
          {report?.activeRules.join("\n") ??
            "Waiting for engine initialization."}
        </pre>
      </details>
      <details>
        <summary>Discarded lints and reasons</summary>
        <pre data-testid="discarded-lints">
          {JSON.stringify(report?.discardedLints ?? [], null, 2)}
        </pre>
      </details>
      <details>
        <summary>Raw Harper lints (before filtering)</summary>
        <pre data-testid="raw-lints">
          {JSON.stringify(report?.rawLints ?? [], null, 2)}
        </pre>
      </details>
    </details>
  );
}
