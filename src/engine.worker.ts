import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import type { Settings } from "./model";
const engine = new Proofreader(new LocalLinter({ binary }), {
  diagnostics: import.meta.env.DEV,
});
const ready = engine.initialize();
void ready.catch(() => {});
interface Request {
  id: number;
  text: string;
  settings: Settings;
  words: string[];
  init?: boolean;
}
function diagnostics(id: number) {
  if (!import.meta.env.DEV) return {};
  const report = engine.getDiagnostics();
  // Local browser/worker console only. Never send diagnostics to an HTTP endpoint or persist them.
  console.debug("[ProofLab diagnostics]", { requestId: id, ...report });
  return { diagnostics: report };
}
async function process(data: Request) {
  try {
    const metadata = await ready;
    if (data.init) {
      self.postMessage({ id: data.id, metadata, ...diagnostics(data.id) });
      return;
    }
    const issues = await engine.analyze(data.text, data.settings, data.words);
    self.postMessage({
      id: data.id,
      issues,
      mappingFailureCount: engine.mappingFailureCount,
      ...diagnostics(data.id),
    });
  } catch (error) {
    if (import.meta.env.DEV)
      console.error("[ProofLab diagnostics] Local engine failure", error);
    self.postMessage({
      id: data.id,
      error: "Local proofreading failed. Reload ProofLab to retry.",
      ...diagnostics(data.id),
    });
  }
}
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<Request>) => {
  queue = queue.then(() => process(data));
};
