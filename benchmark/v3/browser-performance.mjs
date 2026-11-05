import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
// Identical public synthetic fixtures used by the Node harness, loaded from its recorded input generator.
const { documentOf } = await import("./documents-runtime.mjs");
const rows = [],
  startup = [];
for (const [mode, url] of [
  ["baseline", "http://127.0.0.1:4191/prooflab/"],
  ["v3", "http://127.0.0.1:4192/"],
]) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Performance.enable");
  const sys = await browser.newBrowserCDPSession();
  await page.addInitScript(() => {
    const Original = window.Worker;
    window.__bench = { sent: 0, received: 0, latencies: [], starts: {} };
    window.Worker = class extends Original {
      constructor(...args) {
        super(...args);
        this.addEventListener("message", ({ data }) => {
          if (window.__bench.starts[data.id] !== undefined) {
            window.__bench.received++;
            window.__bench.latencies.push(
              performance.now() - window.__bench.starts[data.id],
            );
          }
        });
      }
      postMessage(data, ...rest) {
        if (!data.init) {
          window.__bench.sent++;
          window.__bench.starts[data.id] = performance.now();
        }
        return super.postMessage(data, ...rest);
      }
    };
  });
  const at = Date.now();
  await page.goto(url);
  await page
    .getByText("Harper · running on your device", { exact: true })
    .waitFor();
  await page.waitForFunction(
    () => window.__bench.sent === window.__bench.received,
  );
  startup.push({ mode, ms: Date.now() - at });
  const editor = page.getByRole("textbox", { name: "Document text" });
  for (const words of [1000, 5000, 10000])
    for (let trial = 0; trial < 3; trial++)
      for (const kind of ["changed", "unchanged"]) {
        const before = (await cdp.send("Performance.getMetrics")).metrics;
        const cpuBefore = (
          await sys.send("SystemInfo.getProcessInfo")
        ).processInfo.reduce((n, p) => n + p.cpuTime, 0);
        await page.evaluate(() => {
          window.__gaps = [];
          window.__long = [];
          window.__last = performance.now();
          window.__raf = requestAnimationFrame(function tick(now) {
            window.__gaps.push(now - window.__last);
            window.__last = now;
            window.__raf = requestAnimationFrame(tick);
          });
          window.__obs = new PerformanceObserver((list) =>
            window.__long.push(...list.getEntries().map((x) => x.duration)),
          );
          window.__obs.observe({ type: "longtask", buffered: false });
        });
        const target = await page.evaluate(() => window.__bench.sent + 1);
        const start = Date.now();
        if (kind === "changed") {
          await editor.focus();
          await page.evaluate(
            (text) => {
              const el = document.querySelector('[role="textbox"]');
              const r = document.createRange();
              r.selectNodeContents(el);
              getSelection().removeAllRanges();
              getSelection().addRange(r);
              const data = new DataTransfer();
              data.setData("text/plain", text);
              document.querySelector('[role="textbox"]').dispatchEvent(
                new ClipboardEvent("paste", {
                  bubbles: true,
                  cancelable: true,
                  clipboardData: data,
                }),
              );
            },
            documentOf(words, trial),
          );
        } else {
          await editor.evaluate((el) => {
            const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            const node = walker.nextNode();
            const r = document.createRange();
            r.setStart(node, 0);
            r.setEnd(node, 3);
            getSelection().removeAllRanges();
            getSelection().addRange(r);
          });
          await page.getByRole("button", { name: "Bold", exact: true }).click();
        }
        await page.waitForFunction(
          (n) => window.__bench.sent >= n && window.__bench.received >= n,
          target,
        );
        await page
          .getByText("Checking locally…", { exact: true })
          .waitFor({ state: "hidden" });
        const observed = await page.evaluate(() => {
          cancelAnimationFrame(window.__raf);
          window.__obs.disconnect();
          return {
            workerReplyMs: window.__bench.latencies.at(-1),
            maxFrameGapMs: Math.max(0, ...window.__gaps),
            longTasks: window.__long,
            issues: document.querySelectorAll(".issue").length,
          };
        });
        const after = (await cdp.send("Performance.getMetrics")).metrics;
        const metric = (xs, k) => xs.find((x) => x.name === k)?.value ?? 0;
        const cpuAfter = (
          await sys.send("SystemInfo.getProcessInfo")
        ).processInfo.reduce((n, p) => n + p.cpuTime, 0);
        rows.push({
          mode,
          words,
          trial,
          kind,
          wallIncludingDebounceMs: Date.now() - start,
          ...observed,
          mainTaskMs:
            (metric(after, "TaskDuration") - metric(before, "TaskDuration")) *
            1000,
          browserCpuMs: (cpuAfter - cpuBefore) * 1000,
          mainHeapBytes: metric(after, "JSHeapUsedSize"),
        });
      }
  await browser.close();
}
writeFileSync(
  "benchmark/v3/reports/browser-performance.json",
  JSON.stringify(
    {
      method:
        "Three repetitions; worker request/reply, RAF gaps, long tasks, CDP process CPU and main-frame heap. No input text is transmitted outside local static servers.",
      startup,
      rows,
    },
    null,
    2,
  ) + "\n",
);
console.log(JSON.stringify({ startup, rows: rows.length }));
