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

it("bounds queued work to the active request and latest pending revision", async () => {
  let worker: any;
  class Transport {
    onmessage: any;
    onerror: any;
    postMessage = vi.fn();
    constructor() {
      worker = this;
    }
  }
  vi.stubGlobal("Worker", Transport);
  try {
    const { analyze } = await import("./engine");
    const first = analyze("A", defaults(), [], 1);
    const middle = analyze("B", defaults(), [], 2);
    const latest = analyze("C", defaults(), [], 3);
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    await expect(middle).resolves.toMatchObject({
      revision: 2,
      superseded: true,
    });
    worker.onmessage({
      data: {
        id: worker.postMessage.mock.calls[0][0].id,
        revision: 1,
        issues: [],
      },
    });
    await first;
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1][0].text).toBe("C");
    worker.onmessage({
      data: {
        id: worker.postMessage.mock.calls[1][0].id,
        revision: 3,
        issues: [],
      },
    });
    await expect(latest).resolves.toMatchObject({ revision: 3, issues: [] });
  } finally {
    vi.unstubAllGlobals();
    vi.resetModules();
  }
});
