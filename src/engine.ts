import type { EngineDiagnostics } from "./diagnostics";
import type { Issue, Settings } from "./model";
const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), {
  type: "module",
});
let next = 0;
const pending = new Map<
  number,
  { resolve: (value: Reply) => void; reject: (reason: Error) => void }
>();
let activeAnalysis: number | undefined;
let queuedAnalysis: { id: number; data: { revision?: number } } | undefined;
export interface Reply {
  superseded?: boolean;
  diagnostics?: EngineDiagnostics;
  mappingFailureCount?: number;
  issues?: Issue[];
  revision?: number;
  metadata?: {
    rules: Record<string, string>;
    config: Record<string, boolean | null>;
  };
}
worker.onmessage = ({ data }) => {
  const p = pending.get(data.id);
  if (!p) return;
  pending.delete(data.id);
  if (data.error) p.reject(Error(data.error));
  else p.resolve(data);
  if (data.id === activeAnalysis) {
    activeAnalysis = undefined;
    if (queuedAnalysis) {
      const q = queuedAnalysis;
      queuedAnalysis = undefined;
      activeAnalysis = q.id;
      worker.postMessage({ ...q.data, id: q.id });
    }
  }
};
let failure: Error | undefined;
worker.onerror = () => {
  failure = Error("The local grammar worker could not start. Reload ProofLab.");
  for (const p of pending.values())
    p.reject(
      Error("The local grammar worker could not start. Reload ProofLab."),
    );
  pending.clear();
  queuedAnalysis = undefined;
  activeAnalysis = undefined;
};
function request(data: object, analysis = false): Promise<Reply> {
  return new Promise((resolve, reject) => {
    if (failure) {
      reject(failure);
      return;
    }
    const id = ++next;
    pending.set(id, { resolve, reject });
    if (analysis && activeAnalysis !== undefined) {
      if (queuedAnalysis) {
        pending
          .get(queuedAnalysis.id)
          ?.resolve({
            revision: queuedAnalysis.data.revision,
            superseded: true,
          });
        pending.delete(queuedAnalysis.id);
      }
      queuedAnalysis = { id, data };
    } else {
      if (analysis) activeAnalysis = id;
      worker.postMessage({ ...data, id });
    }
  });
}
export const initialize = () => request({ init: true });
export const analyze = async (
  text: string,
  settings: Settings,
  words: string[],
  revision = 0,
) => {
  const result = await request({ text, settings, words, revision }, true);
  if (result.revision !== revision) throw Error("Analysis revision mismatch.");
  return result;
};
