import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const rows = [];
for (const [mode, url] of [
  ["baseline", "http://127.0.0.1:4191/prooflab/"],
  ["v3", "http://127.0.0.1:4192/"],
]) {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (let trial = 0; trial < 3; trial++) {
    const at = Date.now();
    if (trial) await p.reload();
    else await p.goto(url);
    await p
      .getByText("Harper · running on your device", { exact: true })
      .waitFor();
    rows.push({
      mode,
      trial,
      cache: trial ? "warm" : "cold",
      ms: Date.now() - at,
    });
  }
  await b.close();
}
writeFileSync(
  "benchmark/v3/reports/startup.json",
  JSON.stringify({ rows }, null, 2) + "\n",
);
console.log(JSON.stringify(rows));
