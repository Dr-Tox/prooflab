import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import type { Settings } from "./model";
const engine = new Proofreader(new LocalLinter({ binary }));
const ready = engine.initialize();
void ready.catch(() => {});
interface Request {
  id: number;
  text: string;
  settings: Settings;
  words: string[];
  init?: boolean;
}
async function process(data: Request) {
  try {
    const metadata = await ready;
    if (data.init) {
      self.postMessage({ id: data.id, metadata });
      return;
    }
    const issues = await engine.analyze(data.text, data.settings, data.words);
    self.postMessage({ id: data.id, issues });
  } catch {
    self.postMessage({
      id: data.id,
      error: "Local proofreading failed. Reload ProofLab to retry.",
    });
  }
}
// Never interleave dialect/configuration changes with another analysis.
let queue = Promise.resolve();
self.onmessage = ({ data }: MessageEvent<Request>) => {
  queue = queue.then(() => process(data));
};
