import { openDB } from "idb";
import { defaults, seedWords, type Settings } from "./model";
// Reuse one connection instead of opening a new database on every edit.
let connection: ReturnType<typeof openDB> | undefined;
const database = () =>
  (connection ??= openDB("prooflab", 1, {
    upgrade(db) {
      db.createObjectStore("local");
    },
  }));
export async function readLocal<T>(key: string): Promise<T | undefined> {
  const db = await database();
  return db.get("local", key);
}
export async function writeLocal(key: string, value: unknown) {
  const db = await database();
  await db.put("local", value, key);
}
export async function removeLocal(key: string) {
  const db = await database();
  await db.delete("local", key);
}
export async function loadLocal() {
  return {
    settings: { ...defaults(), ...(await readLocal<Settings>("settings")) },
    words: (await readLocal<string[]>("dictionary")) ?? seedWords,
  };
}

/** Commit consent and its document copy atomically; never retain a document with saving disabled. */
export async function saveLocalState(
  settings: Settings,
  words: string[],
  document: string | null,
) {
  const db = await database();
  const tx = db.transaction("local", "readwrite");
  await Promise.all([
    tx.store.put(settings, "settings"),
    tx.store.put(words, "dictionary"),
    settings.saveDocument && document !== null
      ? tx.store.put(document, "document")
      : tx.store.delete("document"),
  ]);
  await tx.done;
}
