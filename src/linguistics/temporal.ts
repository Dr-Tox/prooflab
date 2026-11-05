import { stativeVerbs } from "./verbChain";
import { enabled, issue, type Issue, type Settings } from "../model";
import {
  temporalFrames,
  subsequentVerb,
  type TemporalFrame,
} from "./temporalFrames";
import type { Token } from "./morphology";
export interface TimeAnchor {
  start: number;
  end: number;
  kind: "closed-past" | "calendar";
  label: string;
}
const periods = new Set(
  "day days week weeks month months year years Monday Tuesday Wednesday Thursday Friday Saturday Sunday"
    .toLowerCase()
    .split(" "),
);
const durations = new Set(
  "second seconds minute minutes hour hours day days week weeks month months year years".split(
    " ",
  ),
);
const numberWords = new Set(
  "one two three four five six seven eight nine ten several".split(" "),
);
const possessive = (w: string) => w.replace(/['’]s$/, "");
/** Token sequences describe local time expressions, not arbitrary document-wide tense. */
export function closedAnchors(t: Token[]): TimeAnchor[] {
  const out: TimeAnchor[] = [];
  for (let i = 0; i < t.length; i++) {
    const w = t[i].lower;
    let end = i,
      kind: TimeAnchor["kind"] | undefined;
    if (w === "yesterday") kind = "closed-past";
    if (w === "last" && periods.has(possessive(t[i + 1]?.lower ?? ""))) {
      kind = "closed-past";
      end = i + 1;
    }
    if (
      (/^\d+$/.test(w) || numberWords.has(w)) &&
      durations.has(t[i + 1]?.lower) &&
      t[i + 2]?.lower === "ago"
    ) {
      kind = "closed-past";
      end = i + 2;
    }
    if (w === "in" && /^\d{4}$/.test(t[i + 1]?.word ?? "")) {
      kind = "calendar";
      end = i + 1;
    }
    if (!kind) continue;
    // A rolling interval remains open: “over/during the last week”. A noun's
    // possessive (“yesterday's samples”) is never an event-time anchor.
    const prefix = t.slice(Math.max(0, i - 3), i).map((x) => x.lower);
    if (
      prefix.includes("over") ||
      prefix.includes("within") ||
      (prefix.at(-1) === "the" &&
        ["during", "in"].some((w) => prefix.includes(w)))
    )
      continue;
    out.push({
      start: t[i].start,
      end: t[end].end,
      kind,
      label: t
        .slice(i, end + 1)
        .map((t) => t.word)
        .join(" "),
    });
  }
  return out;
}
function attachedToEvent(f: TemporalFrame, a: TimeAnchor) {
  const e = f.event;
  if (!e) return false;
  if (a.end <= e.start) {
    const comma = f.tokens.find((t) => t.word === "," && t.end <= e.start);
    return (
      (a.start === f.start && !/[’']s$/.test(a.label)) ||
      (!!comma && a.end <= comma.start)
    );
  } // A fronted temporal adjunct applies to its clause.
  const between = f.tokens.filter((t) => t.start >= e.end && t.end <= a.start);
  if (between.some((t) => ["that", "which", "who", "from"].includes(t.lower)))
    return false;
  return !subsequentVerb(f.tokens, e, a.start); // e.g. samples collected yesterday.
}

const anaphors = [
  ["at", "that", "time"],
  ["on", "that", "day"],
  ["at", "that", "point"],
  ["during", "that", "experiment"],
  ["in", "that", "experiment"],
];
export function temporalAnalysis(text: string, settings: Settings) {
  const document = temporalFrames(text);
  const issues: Issue[] = [];
  const add = (
    rule: string,
    f: TemporalFrame,
    explanation: string,
    start = f.event?.start ?? f.start,
    end = f.event?.end ?? f.end,
  ) => {
    if (
      !enabled(rule, settings) ||
      document.quoted.some((q) => start >= q.start && start < q.end)
    )
      return;
    issues.push({
      ...issue(rule, "Grammar", start, end, text, [], explanation),
      confidence: "low",
    });
  };
  const anchorsOf = (f: TemporalFrame) =>
    closedAnchors(f.tokens).filter(
      (a) =>
        attachedToEvent(f, a) &&
        !document.quoted.some((q) => a.start >= q.start && a.end <= q.end),
    );
  for (const f of document.frames) {
    const e = f.event;
    if (!e) continue;
    const anchors = anchorsOf(f);
    if (e.tense === "present" && e.perfect && anchors.length) {
      add(
        "Tense context review",
        f,
        `The present-perfect construction is linked to the bounded time “${anchors[0].label}”. Standard English usually uses a past-time construction for a completed dated event. Review the intended time; no rewrite of the result or chronology is inferred.`,
        e.start,
        e.end,
      );
    }
    if (
      e.tense === "future" &&
      !e.perfect &&
      anchors.some((a) => a.kind === "closed-past")
    )
      add(
        "Tense context review",
        f,
        "This future construction is linked to an explicit past-time expression. Check the reference time: quotation, prediction or narrative perspective may explain the wording. No chronological correction is inferred.",
      );
    if (e.ambiguousAuxiliary && !e.lexicalHave)
      add(
        "Temporal auxiliary review",
        f,
        "This auxiliary chain mixes incompatible aspect forms. Choosing a perfect or progressive repair could change whether the action was completed or ongoing. Review the intended aspect; no automatic replacement is offered.",
      );
    if (e.progressive && e.lexical && stativeVerbs.has(e.lexical))
      add(
        "Aspect context review",
        f,
        `“${e.lexical}” usually describes a state in this sense. Review whether a simple form or an intentional temporary/dynamic reading is intended. This is contextual guidance, not an inferred change to the scientific claim.`,
      );
    const prev = document.frames[f.id - 1];
    if (
      prev?.event &&
      prev.event.tense === "past" &&
      prev.section === f.section &&
      anchorsOf(prev).length > 0 &&
      !/\n\s*\n/.test(text.slice(prev.end, f.start)) &&
      anaphors.some((words) =>
        words.every((w, i) => f.tokens[i]?.lower === w),
      ) &&
      e.tense === "present" &&
      e.perfect
    ) {
      add(
        "Temporal reference review",
        f,
        "The explicit backward time reference points to the preceding bounded past event, but this clause uses the present perfect. Review the reference time and intended completion/continuation; the order of experiments is not inferred or rewritten.",
      );
    }
  }
  for (const r of document.relations) {
    const main = document.frames[r.main],
      sub = document.frames[r.subordinate],
      m = main.event,
      s = sub.event;
    if (
      ["when", "before", "after", "until", "once"].includes(r.kind) &&
      m?.tense === "future" &&
      s?.tense === "future" &&
      main.id > sub.id
    ) {
      add(
        "Temporal clause review",
        sub,
        `An initial time clause introduced by “${r.kind}” normally uses a present-time form when the main clause refers to the future. Review any intentional volitional or quoted reading; no event order or certainty is changed.`,
      );
    }
    if (
      r.kind === "by the time" &&
      s?.tense === "past" &&
      m?.tense === "present" &&
      m.perfect
    )
      add(
        "Temporal reference review",
        main,
        "“By the time” establishes a past reference point in the other clause, while this clause uses the present perfect. Review the intended reference time; a past-perfect or other repair depends on the intended chronology.",
      );
    if (r.kind !== "since" || !m) continue;
    const t = sub.tokens.slice(1);
    const duration =
      (/^\d+$/.test(t[0]?.lower ?? "") || numberWords.has(t[0]?.lower)) &&
      durations.has(t[1]?.lower);
    if (
      duration &&
      !["ago", "before", "after"].includes(t[2]?.lower) &&
      (!t[2] || /[.!?,;]/.test(t[2].word))
    ) {
      add(
        "Temporal interval review",
        sub,
        "“Since” normally introduces a starting point, whereas this phrase gives a duration. Review whether you mean a duration (“for”) or a dated starting point (“since … ago”); ProofLab does not select a chronology for you.",
        sub.tokens[0].start,
        t[1].end,
      );
    }
    const hasPoint = t.some(
      (t) => /^\d{4}$/.test(t.word) || ["yesterday", "last"].includes(t.lower),
    );
    const ongoing = main.tokens.some((t) =>
      ["still", "continuously", "continually"].includes(t.lower),
    );
    if (
      !s &&
      hasPoint &&
      ongoing &&
      m.tense === "present" &&
      !m.perfect &&
      !m.modal
    )
      add(
        "Temporal interval review",
        main,
        "An explicitly continuing action is linked to a past starting point with “since”, but the main clause uses a simple-present construction. Review whether a perfect or perfect-progressive form is intended; no duration or completion claim is rewritten.",
        m.start,
        sub.end,
      );
  }
  return { ...document, issues };
}
