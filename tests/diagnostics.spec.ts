import { test, expect } from "@playwright/test";
import type { EngineDiagnostics } from "../src/diagnostics";
test("development diagnostics distinguish upstream limitations from adapter filtering and stay local", async ({
  page,
  context,
}) => {
  const requests: { url: string; body: string | null }[] = [];
  context.on("request", (r) =>
    requests.push({ url: r.url(), body: r.postData() }),
  );
  const localReports: EngineDiagnostics[] = [];
  page.on("console", async (message) => {
    if (message.text().startsWith("[ProofLab diagnostics]")) {
      const args = message.args();
      if (args[1]) localReports.push(await args[1].jsonValue());
    }
  });
  await page.goto("./");
  await expect(page.getByTestId("engine-initialization")).toHaveText("ready");
  const editor = page.getByRole("textbox", { name: "Document text" });
  await editor.fill("I wanted to visit mi uncles last nigh");
  await expect(page.getByTestId("custom-issue-count")).toHaveText("1");
  await expect(page.getByTestId("raw-lint-count")).toHaveText("0");
  await expect(page.getByTestId("accepted-lint-count")).toHaveText("0");
  await expect(page.getByTestId("discarded-lints")).toHaveText("[]");
  await editor.fill(
    "🧪 PRIVATE_DEV_DIAGNOSTIC_92831 I recieve teh usefull sample. She are happy. The the sample.",
  );
  await expect(
    page.locator(".mark").filter({ hasText: "recieve" }),
  ).toBeVisible();
  await expect(page.getByTestId("raw-lints")).toContainText("recieve");
  await expect(page.getByTestId("active-rules")).toContainText("SpellCheck");
  await expect
    .poll(() =>
      localReports.some((r) =>
        r.rawLints?.some(
          (l) => l.problemText === "recieve" && l.sourceSlice === "recieve",
        ),
      ),
    )
    .toBe(true);
  const stored = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("prooflab");
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    return new Promise<string>((resolve) => {
      const r = db.transaction("local").objectStore("local").getAll();
      r.onsuccess = () => {
        db.close();
        resolve(JSON.stringify(r.result));
      };
    });
  });
  expect(stored).not.toContain("PRIVATE_DEV_DIAGNOSTIC_92831");
  await page.getByRole("button", { name: "⚙ Settings", exact: true }).click();
  await page.getByLabel("Search rules").fill("SpellCheck");
  await page
    .locator(".rule")
    .filter({ hasText: "SpellCheck" })
    .getByRole("checkbox")
    .uncheck();
  await page.getByRole("button", { name: "▤ Editor", exact: true }).click();
  await expect(page.getByTestId("analysis-status")).toHaveText("complete");
  await expect(page.getByTestId("active-rules")).not.toContainText(
    "SpellCheck",
  );
  await expect(
    page.getByText("Spelling checking is disabled in Settings."),
  ).toBeVisible();
  await editor.fill("A xenofluxomics sample.");
  await page.getByRole("button", { name: "⚙ Settings", exact: true }).click();
  await page
    .locator(".rule")
    .filter({ hasText: "SpellCheck" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "▧ Dictionary", exact: true }).click();
  await page.getByLabel("New dictionary term").fill("xenofluxomics");
  await page.getByRole("button", { name: "Add term", exact: true }).click();
  await page.getByRole("button", { name: "▤ Editor", exact: true }).click();
  await expect(page.getByTestId("discarded-lints")).toContainText(
    "dictionary-term",
  );
  for (const request of requests) {
    expect(request.url + (request.body ?? "")).not.toContain(
      "PRIVATE_DEV_DIAGNOSTIC_92831",
    );
    expect(new URL(request.url).origin).toBe("http://127.0.0.1:4175");
  }
});
