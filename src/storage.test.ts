import "fake-indexeddb/auto";
import { it, expect } from "vitest";
import {
  loadLocal,
  writeLocal,
  readLocal,
  removeLocal,
  saveLocalState,
} from "./storage";
import { defaults } from "./model";
it("persists settings, words and opt-in documents separately", async () => {
  const s = defaults();
  s.dialect = "UK";
  await writeLocal("settings", s);
  await writeLocal("dictionary", ["PFAS", "caseSensitive"]);
  expect((await loadLocal()).settings.dialect).toBe("UK");
  expect((await loadLocal()).words).toEqual(["PFAS", "caseSensitive"]);
  expect(await readLocal("document")).toBeUndefined();
  await writeLocal("document", "Explicit local save");
  expect(await readLocal("document")).toBe("Explicit local save");
  await removeLocal("document");
  expect(await readLocal("document")).toBeUndefined();
});

it("atomically revokes saving consent and deletes the saved document", async () => {
  const s = defaults();
  s.saveDocument = true;
  await saveLocalState(s, ["PFAS"], "Saved with consent");
  expect(await readLocal("document")).toBe("Saved with consent");
  s.saveDocument = false;
  await saveLocalState(s, ["PFAS"], null);
  expect((await loadLocal()).settings.saveDocument).toBe(false);
  expect(await readLocal("document")).toBeUndefined();
});
