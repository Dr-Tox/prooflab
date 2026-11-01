import { useEffect, useRef, useState } from "react";
import { analyze, initialize } from "./engine";
import {
  applyCorrection,
  defaults,
  enabled,
  exportDictionary,
  parseDictionary,
  scientificRules,
  seedWords,
  type Category,
  type Issue,
  type Profile,
  type Settings,
} from "./model";
import { loadLocal, saveLocalState, readLocal } from "./storage";
const categories: Category[] = [
  "Grammar",
  "Spelling",
  "Punctuation",
  "Style",
  "Scientific",
];
const example =
  "The the results suggest that hepatotoxicity may occur in exposed cells. In order to compare groups, we measured 10mg of the sample. PFAS and pfas were evaluated. This is a usefull observation.";
function download(name: string, content: string) {
  const url = URL.createObjectURL(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function App() {
  const [text, setText] = useState(""),
    [settings, setSettingsState] = useState<Settings>(defaults),
    [words, setWordsState] = useState<string[]>(seedWords),
    [loaded, setLoaded] = useState(false),
    [rules, setRules] = useState<Record<string, string>>({}),
    [config, setConfig] = useState<Record<string, boolean | null>>({}),
    [issues, setIssues] = useState<Issue[]>([]),
    [ignored, setIgnored] = useState<string[]>([]),
    [selected, setSelected] = useState<string | null>(null),
    [filter, setFilter] = useState("All"),
    [tab, setTab] = useState("Editor"),
    [status, setStatus] = useState("Loading local engine…"),
    [notice, setNotice] = useState(""),
    [query, setQuery] = useState(""),
    [newWord, setNewWord] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [ruleQuery, setRuleQuery] = useState(""),
    [busy, setBusy] = useState(true),
    [offlineReady, setOfflineReady] = useState(false),
    [storageStatus, setStorageStatus] = useState("Loading local preferences…");
  const editor = useRef<HTMLDivElement>(null),
    history = useRef<{ text: string; html: string }[]>([]),
    revision = useRef(0),
    storageQueue = useRef(Promise.resolve()),
    storageRevision = useRef(0);
  function markStoragePending() {
    // Invalidate an old completion before scheduling the state/effect update.
    ++storageRevision.current;
    setStorageStatus("Saving locally…");
  }
  function setSettings(action: Settings | ((s: Settings) => Settings)) {
    markStoragePending();
    setSettingsState(action);
  }
  function setWords(action: string[] | ((words: string[]) => string[])) {
    markStoragePending();
    setWordsState(action);
  }
  const persist = (task: () => Promise<unknown>) => {
    const r = ++storageRevision.current;
    setStorageStatus("Saving locally…");
    storageQueue.current = storageQueue.current
      .then(task)
      .then(() => {
        if (r === storageRevision.current)
          setStorageStatus("Local changes saved.");
      })
      .catch(() => {
        setStorageStatus("Local changes could not be saved.");
        setNotice("Local storage failed. Your changes remain in this session.");
      });
  };
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready.then(() => setOfflineReady(true));
    }
  }, []);
  useEffect(() => {
    loadLocal()
      .then(async (data) => {
        setSettings(data.settings);
        setWords(data.words);
        if (data.settings.saveDocument) {
          const saved = await readLocal<string>("document");
          if (saved) {
            setText(saved);
            if (editor.current) editor.current.textContent = saved;
          }
        }
        setLoaded(true);
      })
      .catch(() => {
        setLoaded(true);
        setNotice("Local storage is unavailable. Settings cannot be saved.");
      });
    initialize()
      .then((r) => {
        setRules(r.metadata!.rules);
        setConfig(r.metadata!.config);
      })
      .catch(() => setStatus("Harper could not load. Reload to retry."));
  }, []);
  const documentToSave = settings.saveDocument ? text : null;
  useEffect(() => {
    if (!loaded) return;
    persist(() => saveLocalState(settings, words, documentToSave));
  }, [settings, words, documentToSave, loaded]);
  useEffect(() => {
    if (!loaded) return;
    const r = ++revision.current;
    setBusy(true);
    setIssues([]);
    const timer = setTimeout(() => {
      analyze(text, settings, words)
        .then((result) => {
          if (r !== revision.current) return;
          setIssues(result.issues!);
          setBusy(false);
          setStatus("Harper · running on your device");
        })
        .catch(() => {
          if (r === revision.current) {
            setBusy(false);
            setStatus("Proofreading failed. Reload to retry.");
          }
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [text, settings, words, loaded]);
  function snapshot() {
    history.current.push({ text, html: editor.current?.innerHTML ?? text });
    if (history.current.length > 100) history.current.shift();
  }
  function changeText(value: string) {
    snapshot();
    if (editor.current) editor.current.textContent = value;
    setText(value);
    setIgnored([]);
    setSelected(null);
  }
  function insertPlainText(value: string) {
    const el = editor.current;
    if (!el) return;
    el.focus();
    const selection = getSelection();
    if (!selection) return;
    let range: Range;
    if (
      selection.rangeCount &&
      el.contains(selection.getRangeAt(0).commonAncestorContainer)
    ) {
      range = selection.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    range.deleteContents();
    const node = document.createTextNode(value);
    range.insertNode(node);
    // Chromium needs a trailing BR to place a caret after a terminal newline.
    // BR has no textContent, so the canonical plain-text offsets stay unchanged.
    if (el.textContent?.endsWith("\n") && el.lastChild?.nodeName !== "BR") {
      el.appendChild(document.createElement("br"));
    }
    range.setStart(node, value.length);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    setText(el.textContent ?? "");
    setIgnored([]);
    setSelected(null);
  }
  function undo() {
    const old = history.current.pop();
    if (!old) return;
    if (editor.current) editor.current.innerHTML = old.html;
    setText(old.text);
    setIgnored([]);
    setNotice("Change undone.");
  }
  function accept(i: Issue, replacement: string) {
    try {
      const value = applyCorrection(text, i, replacement);
      snapshot();
      const el = editor.current!;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      let pos = 0;
      let start: Node | null = null,
        end: Node | null = null,
        so = 0,
        eo = 0;
      while ((n = walker.nextNode())) {
        const length = n.textContent?.length ?? 0;
        if (start === null && i.start <= pos + length) {
          start = n;
          so = i.start - pos;
        }
        if (i.end <= pos + length) {
          end = n;
          eo = i.end - pos;
          break;
        }
        pos += length;
      }
      if (start && end) {
        const range = document.createRange();
        range.setStart(start, so);
        range.setEnd(end, eo);
        range.deleteContents();
        range.insertNode(document.createTextNode(replacement));
      } else el.textContent = value;
      setText(value);
      setIgnored([]);
      setSelected(null);
    } catch (e) {
      setNotice((e as Error).message);
    }
  }
  function update(patch: Partial<Settings>) {
    setSettings((s) => ({ ...s, ...patch }));
  }
  function addWord(w: string) {
    const word = w.trim();
    if (!word || word.length > 100 || /[\r\n\u0000-\u001f]/.test(word)) {
      setNotice("Enter a term of 1–100 characters.");
      return;
    }
    setWords((v) => [...new Set([...v, word])]);
    setNewWord("");
  }
  const active = issues.filter((i) => !ignored.includes(i.id)),
    visible = active.filter((i) => filter === "All" || i.category === filter),
    chosen = active.find((i) => i.id === selected);
  const marks: React.ReactNode[] = [];
  let cursor = 0;
  for (const i of active) {
    if (i.start < cursor) continue;
    marks.push(text.slice(cursor, i.start));
    marks.push(
      <button
        className={`mark ${i.category.toLowerCase()} ${selected === i.id ? "selected" : ""}`}
        key={i.id}
        title={i.explanation}
        onClick={() => {
          setFilter("All");
          setSelected(i.id);
        }}
      >
        {text.slice(i.start, i.end) || "▏"}
      </button>,
    );
    cursor = i.end;
  }
  marks.push(text.slice(cursor));
  return (
    <>
      <header>
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setTab("Editor");
            }}
          >
            <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" />
            ProofLab<span>SCIENTIFIC WRITING</span>
          </a>
          <span className="privacy-pill">
            <span className="dot" />
            Private by design
          </span>
        </div>
      </header>
      <main spellCheck={false}>
        <div className="intro">
          <div>
            <p className="eyebrow">YOUR WORDS. YOUR DEVICE.</p>
            <h1>Clarity for your next discovery.</h1>
            <p>Thoughtful proofreading for precise scientific writing.</p>
          </div>
          <button className="quiet" onClick={() => setTab("Privacy")}>
            ◈ How your text stays private
          </button>
        </div>
        <nav aria-label="Main navigation">
          {["Editor", "Dictionary", "Settings", "Privacy"].map((t) => (
            <button
              key={t}
              className={tab === t ? "nav-active" : ""}
              onClick={() => setTab(t)}
            >
              {t === "Editor"
                ? "▤ "
                : t === "Dictionary"
                  ? "▧ "
                  : t === "Settings"
                    ? "⚙ "
                    : "◈ "}
              {t}
            </button>
          ))}
        </nav>
        {notice && (
          <div role="status" className="notice">
            {notice}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </div>
        )}
        <div hidden={tab !== "Editor"}>
          <div className="workspace-top">
            <div>
              <span className="dot" /> Local workspace{" "}
              <span className="muted">/ Untitled document</span>
            </div>
            <label>
              Writing profile{" "}
              <select
                aria-label="Writing profile"
                value={settings.profile}
                onChange={(e) => update({ profile: e.target.value as Profile })}
              >
                {[
                  "General English",
                  "Academic English",
                  "Scientific Writing",
                ].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="workspace">
            <section className="card editor-card">
              <div className="card-heading">
                <div>
                  <h2>Document editor</h2>
                  <p>Make room for your ideas.</p>
                </div>
                <button className="quiet" onClick={() => changeText(example)}>
                  Try an example
                </button>
              </div>
              <div className="toolbar">
                <div>
                  <button
                    aria-label="Bold"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      snapshot();
                      document.execCommand("bold");
                    }}
                  >
                    <b>B</b>
                  </button>
                  <button
                    aria-label="Italic"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      snapshot();
                      document.execCommand("italic");
                    }}
                  >
                    <i>I</i>
                  </button>
                  <span className="separator" />
                  <button onClick={undo}>↶ Undo</button>
                </div>
                <div>
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(text)
                        .then(() => setNotice("Corrected text copied."))
                        .catch(() =>
                          setNotice(
                            "Clipboard access unavailable. Select and copy text manually.",
                          ),
                        )
                    }
                  >
                    Copy text
                  </button>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          "Clear this document? You can undo this action.",
                        )
                      )
                        changeText("");
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div
                ref={editor}
                className="document"
                role="textbox"
                aria-label="Document text"
                aria-multiline="true"
                contentEditable={loaded}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                suppressContentEditableWarning
                data-placeholder="Begin writing, or paste your research here…"
                onBeforeInput={(e) => {
                  snapshot();
                  if (
                    (e.nativeEvent as InputEvent).inputType ===
                    "insertParagraph"
                  ) {
                    e.preventDefault();
                    insertPlainText("\n");
                  }
                }}
                onInput={(e) => {
                  setText(e.currentTarget.textContent ?? "");
                  setIgnored([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    snapshot();
                    insertPlainText("\n");
                  }
                  if ((e.ctrlKey || e.metaKey) && e.key === "z") {
                    e.preventDefault();
                    undo();
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  snapshot();
                  editor.current?.focus();
                  insertPlainText(e.dataTransfer.getData("text/plain"));
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  snapshot();
                  insertPlainText(e.clipboardData.getData("text/plain"));
                }}
              />
              <div className="document-footer">
                <span>
                  {text.trim() ? text.trim().split(/\s+/u).length : 0} words{" "}
                  <span className="separator" /> {Array.from(text).length}{" "}
                  characters
                </span>
                <span>
                  Stored{" "}
                  {settings.saveDocument
                    ? "locally with consent"
                    : "in memory only"}
                </span>
              </div>
              {text && (
                <div className="review">
                  <h3>
                    Highlighted review <span>Click an issue to inspect it</span>
                  </h3>
                  <div className="marked-text">{marks}</div>
                </div>
              )}
            </section>
            <aside className="card analysis">
              <div className="card-heading">
                <div>
                  <h2>
                    Writing insights{" "}
                    <span className="count">{active.length}</span>
                  </h2>
                  <p>
                    {busy
                      ? "Checking locally…"
                      : "A little precision goes a long way."}
                  </p>
                </div>
              </div>
              <div className="filters" aria-label="Issue filters">
                {["All", ...categories].map((c) => (
                  <button
                    key={c}
                    className={filter === c ? "filter-active" : ""}
                    onClick={() => setFilter(c)}
                  >
                    {c}
                    {c === "All"
                      ? ` ${active.length}`
                      : ` ${active.filter((i) => i.category === c).length}`}
                  </button>
                ))}
              </div>
              <div className="issue-list">
                {!text ? (
                  <div className="empty">
                    <div className="empty-symbol">✓</div>
                    <h3>Your next draft starts here</h3>
                    <p>
                      Write or paste your text. Suggestions will appear here,
                      privately.
                    </p>
                    <button
                      className="primary"
                      onClick={() => changeText(example)}
                    >
                      Explore with an example
                    </button>
                  </div>
                ) : busy ? (
                  <p className="empty">Analyzing on your device…</p>
                ) : !visible.length ? (
                  <div className="empty">
                    <div className="empty-symbol">✓</div>
                    <h3>
                      No {filter === "All" ? "visible" : filter.toLowerCase()}{" "}
                      suggestions
                    </h3>
                    <p>
                      ProofLab cannot guarantee error-free or scientifically
                      correct writing.
                    </p>
                  </div>
                ) : (
                  visible.map((i) => (
                    <article
                      key={i.id}
                      className={`issue ${chosen?.id === i.id ? "issue-selected" : ""}`}
                    >
                      <button
                        className="issue-title"
                        onClick={() =>
                          setSelected(selected === i.id ? null : i.id)
                        }
                      >
                        <span
                          className={`category ${i.category.toLowerCase()}`}
                        >
                          {i.category}
                        </span>
                        <strong>{i.original || "Missing punctuation"}</strong>
                        <span>⌄</span>
                      </button>
                      {(selected === i.id || visible.length < 4) && (
                        <div className="issue-detail">
                          <p>{i.explanation}</p>
                          <small>{i.rule}</small>
                          <div className="replacements">
                            {i.replacements.map((r, j) => (
                              <button
                                key={j}
                                className="replacement"
                                onClick={() => accept(i, r)}
                              >
                                {r || "Remove"} <span>↵</span>
                              </button>
                            ))}
                          </div>
                          {!i.replacements.length && (
                            <p className="manual">
                              Manual review · edit in the document
                            </p>
                          )}
                          <div className="issue-actions">
                            <button
                              onClick={() => setIgnored((v) => [...v, i.id])}
                            >
                              Dismiss once
                            </button>
                            <button
                              onClick={() =>
                                update({
                                  ignoredRules: [
                                    ...settings.ignoredRules,
                                    i.rule,
                                  ],
                                })
                              }
                            >
                              Ignore rule
                            </button>
                            {i.category === "Spelling" && (
                              <>
                                <button onClick={() => addWord(i.original)}>
                                  Add term
                                </button>
                                <button
                                  onClick={() =>
                                    update({
                                      ignoredWords: [
                                        ...settings.ignoredWords,
                                        i.original,
                                      ],
                                    })
                                  }
                                >
                                  Ignore word
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  ))
                )}
              </div>
              <div className="engine-status">
                <span className="dot" />
                {status}
              </div>
            </aside>
          </div>
          <div className="footnote">
            <span>◈ Your research never leaves this browser.</span>
            <span>
              Suggestions support your judgment. They do not replace it.
            </span>
          </div>
        </div>
        {tab === "Dictionary" && (
          <section className="card management">
            <div className="card-heading">
              <div>
                <h2>Scientific dictionary</h2>
                <p>
                  Accepted terms are case-sensitive and saved only on this
                  device.
                </p>
              </div>
              <span className="count">{words.length} terms</span>
            </div>
            <div className="management-body">
              <form
                className="inline-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  addWord(newWord);
                }}
              >
                <input
                  aria-label="New dictionary term"
                  placeholder="Add a scientific term, e.g. PFHxA"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                />
                <button className="primary">Add term</button>
              </form>
              <div className="dictionary-tools">
                <input
                  aria-label="Search dictionary"
                  placeholder="Search dictionary…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <label className="file-button">
                  Import TXT / JSON
                  <input
                    aria-label="Import dictionary"
                    type="file"
                    accept=".txt,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        if (file.size > 1000000)
                          throw Error("Dictionary must be smaller than 1 MB.");
                        const added = parseDictionary(
                          await file.text(),
                          file.name.toLowerCase().endsWith(".json")
                            ? "json"
                            : "txt",
                        );
                        setWords((v) => [...new Set([...v, ...added])]);
                        setNotice(`Imported ${added.length} terms.`);
                      } catch (err) {
                        setNotice((err as Error).message);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
                {(["txt", "json"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() =>
                      download(
                        `prooflab-dictionary.${f}`,
                        exportDictionary(words, f),
                      )
                    }
                  >
                    Export {f.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="word-grid">
                {words
                  .filter((w) => w.toLowerCase().includes(query.toLowerCase()))
                  .sort()
                  .map((w) => (
                    <div className="word" key={w}>
                      <code>{w}</code>
                      <button
                        aria-label={`Remove ${w}`}
                        onClick={() =>
                          setWords((v) => v.filter((x) => x !== w))
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
        {tab === "Settings" && (
          <section className="card management">
            <div className="card-heading">
              <div>
                <h2>Make ProofLab work for you</h2>
                <p>
                  Profiles set defaults. Individual overrides take precedence.
                </p>
              </div>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Restore default settings? Your dictionary will be kept. Saved document content will be deleted.",
                    )
                  ) {
                    setSettings(defaults());
                    setIgnored([]);
                  }
                }}
              >
                Restore defaults
              </button>
            </div>
            <div className="management-body settings-grid">
              <div>
                <h3>Writing preferences</h3>
                <label className="setting">
                  Profile
                  <select
                    value={settings.profile}
                    onChange={(e) =>
                      update({ profile: e.target.value as Profile })
                    }
                  >
                    {[
                      "General English",
                      "Academic English",
                      "Scientific Writing",
                    ].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="setting">
                  English dialect
                  <select
                    value={settings.dialect}
                    onChange={(e) =>
                      update({ dialect: e.target.value as "US" | "UK" })
                    }
                  >
                    <option value="US">US English</option>
                    <option value="UK">UK English</option>
                  </select>
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.siSpace}
                    onChange={(e) => update({ siSpace: e.target.checked })}
                  />
                  Check spacing before selected SI units
                </label>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={settings.saveDocument}
                    onChange={(e) => update({ saveDocument: e.target.checked })}
                  />
                  I consent to save this document on this device
                </label>
                <p className="muted">
                  Wait for “Local changes saved” before closing this tab.
                  Turning off local saving deletes the saved copy. Formatting is
                  session-only. Shared browser profiles can read locally saved
                  data.
                </p>
                <p role="status" aria-live="polite">
                  {storageStatus}
                </p>
                <h3>Preferred terminology</h3>
                <p className="muted">
                  Literal, case-sensitive matches; suggestions require manual
                  edits.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (from.trim() && to.trim()) {
                      update({
                        substitutions: [
                          ...settings.substitutions,
                          { from: from.trim(), to: to.trim() },
                        ],
                      });
                      setFrom("");
                      setTo("");
                    }
                  }}
                >
                  <input
                    aria-label="Original terminology"
                    placeholder="Original term"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                  />
                  <input
                    aria-label="Preferred terminology"
                    placeholder="Preferred term"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                  />
                  <button className="primary">Add preference</button>
                </form>
                {settings.substitutions.map((s, i) => (
                  <p key={i}>
                    {s.from} → {s.to}{" "}
                    <button
                      onClick={() =>
                        update({
                          substitutions: settings.substitutions.filter(
                            (_, j) => i !== j,
                          ),
                        })
                      }
                    >
                      Remove
                    </button>
                  </p>
                ))}
                <h3>Ignored words</h3>
                {settings.ignoredWords.map((w) => (
                  <p key={w}>
                    {w}{" "}
                    <button
                      onClick={() =>
                        update({
                          ignoredWords: settings.ignoredWords.filter(
                            (x) => x !== w,
                          ),
                        })
                      }
                    >
                      Restore
                    </button>
                  </p>
                ))}
                <h3>Ignored rules</h3>
                {settings.ignoredRules.map((r) => (
                  <p key={r}>
                    {r}{" "}
                    <button
                      onClick={() =>
                        update({
                          ignoredRules: settings.ignoredRules.filter(
                            (x) => x !== r,
                          ),
                        })
                      }
                    >
                      Restore
                    </button>
                  </p>
                ))}
              </div>
              <div>
                <h3>Rule controls</h3>
                <input
                  aria-label="Search rules"
                  placeholder="Search all available rules…"
                  value={ruleQuery}
                  onChange={(e) => setRuleQuery(e.target.value)}
                />
                <div className="rules-list">
                  {Object.entries({ ...scientificRules, ...rules })
                    .filter(([r]) =>
                      r.toLowerCase().includes(ruleQuery.toLowerCase()),
                    )
                    .map(([r, d]) => (
                      <label className="rule" key={r}>
                        <input
                          type="checkbox"
                          checked={enabled(r, settings, config[r] !== false)}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              ignoredRules: s.ignoredRules.filter(
                                (v) => v !== r,
                              ),
                              overrides: {
                                ...s.overrides,
                                [r]: e.target.checked,
                              },
                            }))
                          }
                        />
                        <span>
                          <strong>{r}</strong>
                          <small>{d}</small>
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            </div>
          </section>
        )}
        {tab === "Privacy" && (
          <section className="card management privacy-copy">
            <p className="eyebrow">PRIVATE BY DESIGN</p>
            <h2>Your work stays with you.</h2>
            <p>
              ProofLab checks English using Harper WebAssembly in a local
              browser worker. No AI models, accounts, analytics, remote
              proofreading, or cloud synchronization are used.
            </p>
            <h3>What is stored?</h3>
            <p>
              Your dictionary, ignored words, rule choices, and preferences stay
              in IndexedDB. Document text stays in memory unless you explicitly
              enable local saving in Settings. Turning saving off deletes the
              stored copy. Clear the dictionary and settings through your
              browser’s site-data controls.
            </p>
            <h3>What uses the network?</h3>
            <p>
              The static host receives requests for application files, including
              the bundled grammar engine. Document text is never included in
              requests. A Content Security Policy restricts connections to this
              origin. After the service worker finishes caching, proofreading
              works offline. Installation availability depends on your browser.
            </p>
            <h3>Scientific judgment stays yours</h3>
            <p>
              ProofLab does not validate results, chemical identities, gene
              names, conclusions, or causality. Numeric expressions and likely
              scientific identifiers are protected from replacement suggestions.
              These conservative patterns cannot recognize every scientific
              identifier. Review every correction.
            </p>
            <h3>Scope and limitations</h3>
            <p>
              Local storage is not encrypted. Browser extensions, a compromised
              device, or a compromised application host can access your text.
              Same-origin restrictions are not an independent firewall. Browser
              tests exercise representative flows; they cannot prove the absence
              of every possible data leak. See PRIVACY.md in the repository for
              the full threat model.
            </p>
            <p>
              <a
                href={`${import.meta.env.BASE_URL}licenses/THIRD_PARTY_LICENSES.txt`}
              >
                Bundled third-party licenses
              </a>
            </p>
          </section>
        )}
        <footer>
          <span>
            ProofLab <span className="muted">/ Precision, privately.</span>
          </span>
          <span>
            {offlineReady
              ? "Offline ready · No tracking"
              : "Local-first · No accounts · No tracking"}
          </span>
        </footer>
      </main>
    </>
  );
}
