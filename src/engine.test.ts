import { it, expect, vi } from "vitest";
import { defaults } from "./model";
it("rejects pending and future requests after a fatal worker error instead of waiting forever", async () => {
  let worker: TransportWorker;
  class TransportWorker {
    onmessage: ((event: unknown) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage = vi.fn();
    constructor() {
      worker = this;
    }
  }
  vi.stubGlobal("Worker", TransportWorker);
  try {
    const { initialize, analyze } = await import("./engine");
    const first = expect(initialize()).rejects.toThrow(
      "worker could not start",
    );
    worker!.onerror!();
    await first;
    await expect(analyze("A usefull sample.", defaults(), [])).rejects.toThrow(
      "worker could not start",
    );
    expect(worker!.postMessage).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});

it("does not resolve an analysis under the wrong document revision", async () => {
  let worker: Transport;
  class Transport {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    onerror: (() => void) | null = null;
    postMessage = vi.fn();
    constructor() {
      worker = this;
    }
  }
  vi.stubGlobal("Worker", Transport);
  try {
    const { analyze } = await import("./engine");
    const result = analyze("A usefull sample.", defaults(), [], 37);
    const id = worker!.postMessage.mock.calls[0][0].id;
    worker!.onmessage!({ data: { id, revision: 36, issues: [] } });
    await expect(result).rejects.toThrow("revision mismatch");
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});
