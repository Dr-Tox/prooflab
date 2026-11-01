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
