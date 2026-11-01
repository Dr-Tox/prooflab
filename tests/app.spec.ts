import { test, expect, type Page } from "@playwright/test";
async function ready(page: Page) {
  await page.goto("./");
  await expect(page.getByText("Harper · running on your device")).toBeVisible();
}
async function write(page: Page, text: string) {
  await page.getByRole("textbox", { name: "Document text" }).fill(text);
  await expect(page.getByText("Checking locally…")).not.toBeVisible();
  await expect(page.getByText("Harper · running on your device")).toBeVisible();
}
test("real Harper spelling and grammar, Unicode offsets, accept and undo", async ({
  page,
}) => {
  await ready(page);
  await write(page, "🧪 This is a usefull observation. She are happy.");
  await expect(page.locator(".issue-title")).not.toHaveCount(0);

  await expect(
    page.locator(".issue-title").filter({ hasText: "are" }),
  ).not.toHaveCount(0);
  await page.locator(".mark").filter({ hasText: "usefull" }).click();
  await page.getByRole("button", { name: "useful ↵" }).click();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "🧪 This is a useful observation. She are happy.",
  );
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "🧪 This is a usefull observation. She are happy.",
  );
});
test("scientific terms, dictionary persistence, import and export", async ({
  page,
}) => {
  await ready(page);
  await write(
    page,
    "We evaluated hepatotoxicity, PFHxA, and MYB-NFIB at p = 0.05 with 10mg of H2O.",
  );
  await expect(
    page.locator(".issue-title").filter({ hasText: "Spelling" }),
  ).toHaveCount(0);
  await expect(
    page.locator(".issue").filter({ hasText: "SI spacing" }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "▧ Dictionary", exact: true }).click();
  await page.getByLabel("New dictionary term").fill("toxicomics");
  await page.getByRole("button", { name: "Add term", exact: true }).click();
  await page.getByLabel("Import dictionary").setInputFiles({
    name: "terms.json",
    mimeType: "application/json",
    buffer: Buffer.from('["CaseTerm","CaseTerm","PFHxA"]'),
  });
  await expect(page.getByText("CaseTerm", { exact: true })).toBeVisible();
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  expect((await dl).suggestedFilename()).toBe("prooflab-dictionary.json");
  await page.reload();
  await expect(page.getByText("Harper · running on your device")).toBeVisible();
  await page.getByRole("button", { name: "▧ Dictionary", exact: true }).click();
  await expect(page.getByText("toxicomics", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Remove toxicomics", exact: true })
    .click();
  await expect(page.getByText("toxicomics", { exact: true })).toHaveCount(0);
});
test("rule controls, ignore once, correction sequences and formatting", async ({
  page,
}) => {
  await ready(page);
  await write(
    page,
    "The the sample is a usefull sample. In order to compare groups, we used cells.",
  );
  await page.locator(".mark").filter({ hasText: "The the" }).click();
  await page
    .locator(".issue-selected")
    .getByRole("button", { name: "Dismiss once" })
    .click();
  await expect(
    page.locator(".issue").filter({ hasText: "Repeated words" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "⚙ Settings", exact: true }).click();
  await page.getByLabel("Search rules").fill("Academic redundancy");
  await page
    .locator(".rule")
    .filter({ hasText: "Academic redundancy" })
    .getByRole("checkbox")
    .uncheck();
  await page.getByRole("button", { name: "▤ Editor", exact: true }).click();
  await expect(
    page.locator(".issue").filter({ hasText: "Academic redundancy" }),
  ).toHaveCount(0);
  await page.locator(".mark").filter({ hasText: "usefull" }).click();
  await page.getByRole("button", { name: "useful ↵" }).click();
  await expect(
    page.getByRole("textbox", { name: "Document text" }),
  ).toContainText("useful");
});
test("privacy: only static same-origin GETs, no document persistence by default, CSP and offline engine", async ({
  page,
  context,
}) => {
  const secret = "PRIVATE_PROOFLAB_92831";
  const requests: { url: string; body: string | null; method: string }[] = [];
  context.on("request", (r) =>
    requests.push({ url: r.url(), body: r.postData(), method: r.method() }),
  );
  await ready(page);
  await write(page, `${secret} This is a usefull observation.`);
  await expect(
    page.locator(".mark").filter({ hasText: "usefull" }),
  ).toBeVisible();
  const saved = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open("prooflab");
      r.onsuccess = () => resolve(r.result);
      r.onerror = reject;
    });
    return new Promise((resolve) => {
      const r = db.transaction("local").objectStore("local").get("document");
      r.onsuccess = () => resolve(r.result);
    });
  });
  expect(saved).toBeUndefined();
  expect(
    await page.evaluate(async () => {
      try {
        await fetch("https://example.com/leak");
        return false;
      } catch {
        return true;
      }
    }),
  ).toBe(true);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        return keys.length;
      }),
    )
    .toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByText("Harper · running on your device")).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Harper · running on your device")).toBeVisible();
  await write(page, "This is a usefull observation.");
  await expect(
    page.locator(".mark").filter({ hasText: "usefull" }),
  ).toBeVisible();
  for (const r of requests) {
    expect(r.url + r.body).not.toContain(secret);
    expect(r.method).toBe("GET");
    expect(new URL(r.url).origin).toBe("http://127.0.0.1:4173");
    expect(new URL(r.url).search).toBe("");
  }
});
test("mobile layout, local save opt-in and revoke", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await write(page, "Locally saved text.");
  await page.getByRole("button", { name: "⚙ Settings", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I consent to save this document on this device",
    })
    .check();
  await expect(
    page.getByText("Local changes saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "Locally saved text.",
  );
  await page.getByRole("button", { name: "⚙ Settings", exact: true }).click();
  await page
    .getByRole("checkbox", {
      name: "I consent to save this document on this device",
    })
    .uncheck();
  await expect(
    page.getByText("Local changes saved.", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "",
  );
});

test("rich formatting survives corrections across inline nodes; newline, clear and undo", async ({
  page,
}) => {
  await ready(page);
  await write(page, "This is a usefull sample.");
  await page.getByRole("textbox", { name: "Document text" }).evaluate((el) => {
    const node = el.firstChild!;
    const range = document.createRange();
    range.setStart(node, 13);
    range.setEnd(node, 17);
    const selection = getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.getByRole("button", { name: "Bold", exact: true }).click();
  await expect(page.locator(".document b")).toHaveText("full");
  await page.locator(".mark").filter({ hasText: "usefull" }).click();
  await page.getByRole("button", { name: "useful ↵" }).click();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "This is a useful sample.",
  );
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(page.locator(".document b")).toHaveText("full");
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "This is a usefull sample.",
  );
  await page.getByRole("textbox", { name: "Document text" }).click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("A new line.");
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "This is a usefull sample.\nA new line.",
  );
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "",
  );
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await expect(
    page.getByRole("textbox", { name: "Document text" }),
  ).toContainText("A new line.");
});

test("accept sequential corrections and copy plain text", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await ready(page);
  await write(page, "This is a usefull observation. She are happy.");
  await page.locator(".mark").filter({ hasText: "usefull" }).click();
  await page.getByRole("button", { name: "useful ↵" }).click();
  await page.locator(".mark").filter({ hasText: "are" }).click();
  await page
    .locator(".issue-selected")
    .getByRole("button", { name: "is ↵" })
    .click();
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "This is a useful observation. She is happy.",
  );
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "This is a useful observation. She is happy.",
  );
});

test("ignore rule globally, restore it, and keep terminology separate from dictionary", async ({
  page,
}) => {
  await ready(page);
  await write(page, "This is a usefull observation.");
  await page.locator(".mark").filter({ hasText: "usefull" }).click();
  await page
    .locator(".issue-selected")
    .getByRole("button", { name: "Ignore rule", exact: true })
    .click();
  await expect(
    page.locator(".issue-title").filter({ hasText: "Spelling" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "⚙ Settings", exact: true }).click();
  await page.getByLabel("Original terminology").fill("observation");
  await page
    .getByLabel("Preferred terminology", { exact: true })
    .fill("finding");
  await page.getByRole("button", { name: "Add preference" }).click();
  await page.getByLabel("Search rules").fill("SpellCheck");
  await page
    .locator(".rule")
    .filter({ hasText: "SpellCheck" })
    .getByRole("checkbox")
    .check();
  await page.getByRole("button", { name: "▤ Editor", exact: true }).click();
  await expect(
    page.locator(".issue-title").filter({ hasText: "Spelling" }),
  ).toHaveCount(1);
  await page.locator(".mark").filter({ hasText: "observation" }).click();
  await expect(
    page
      .locator(".issue-selected")
      .getByText(
        "Your preferred wording is “finding”. Review and edit manually to preserve scientific meaning.",
      ),
  ).toBeVisible();
  await expect(page.locator(".issue-selected .replacement")).toHaveCount(0);
});

test("reported sentence gets a review-only warning; unsupported contextual errors get an honest empty state", async ({
  page,
}) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  await ready(page);
  await write(page, "I wanted to visit mi uncles last nigh");
  await expect(page.locator(".issue-title")).toHaveCount(1);
  await page.locator(".mark").filter({ hasText: "last nigh" }).click();
  await expect(page.locator(".issue-selected")).toContainText(
    "check whether you meant “last night”",
  );
  await expect(page.locator(".replacement")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Document text" })).toHaveText(
    "I wanted to visit mi uncles last nigh",
  );
  await expect(page.getByLabel("Engine diagnostics")).toHaveCount(0);
  expect(
    await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content"),
  ).not.toContain("'unsafe-inline'");
  expect(logs.some((l) => l.includes("[ProofLab diagnostics]"))).toBe(false);
  await write(page, "I wanted to visit mi uncles last night.");
  await expect(
    page.getByRole("heading", {
      name: "No issues detected by the enabled rules",
      exact: true,
    }),
  ).toBeVisible();
});

test("editor updates reach the real engine in every profile and filters never imply all rules found nothing", async ({
  page,
}) => {
  await ready(page);
  for (const profile of [
    "General English",
    "Academic English",
    "Scientific Writing",
  ]) {
    await page.getByLabel("Writing profile").selectOption(profile);
    await write(
      page,
      "I recieve teh usefull sample. She are happy. The the sample.",
    );
    for (const word of ["recieve", "teh", "usefull", "are", "The the"])
      await expect(
        page.locator(".issue-title").filter({ hasText: word }).first(),
      ).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Punctuation 0", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "No punctuation issues in this filter",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("No issues detected by the enabled rules", { exact: true }),
  ).toHaveCount(0);
});

test("a worker load failure is an error, never a clean bill of health", async ({
  page,
}) => {
  await page.route("**/engine.worker-*.js", (route) => route.abort());
  await page.goto("./");
  await expect(
    page.getByText("Proofreading failed. Reload to retry.").first(),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Document text" })
    .fill("A usefull sample.");
  await expect(
    page.getByRole("heading", { name: "Proofreading unavailable" }),
  ).toBeVisible();
  await expect(
    page.getByText("No issues detected by the enabled rules", { exact: true }),
  ).toHaveCount(0);
});
