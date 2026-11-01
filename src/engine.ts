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
export interface Reply {
  diagnostics?: EngineDiagnostics;
  mappingFailureCount?: number;
  issues?: Issue[];
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
};
let failure: Error | undefined;
worker.onerror = () => {
  failure = Error("The local grammar worker could not start. Reload ProofLab.");
  for (const p of pending.values())
    p.reject(
      Error("The local grammar worker could not start. Reload ProofLab."),
    );
  pending.clear();
};
function request(data: object): Promise<Reply> {
  return new Promise((resolve, reject) => {
    if (failure) {
      reject(failure);
      return;
    }
    const id = ++next;
    pending.set(id, { resolve, reject });
    worker.postMessage({ ...data, id });
  });
}
export const initialize = () => request({ init: true });
export const analyze = (text: string, settings: Settings, words: string[]) =>
  request({ text, settings, words });
