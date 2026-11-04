import {
  tokenize,
  type Token,
  adverbs,
  verb,
  finiteCandidate,
} from "./morphology";
import { subject } from "./subjects";
import { verbChain, type VerbChain } from "./verbChain";
export const temporalIntroducers = new Set([
  "when",
  "before",
  "after",
  "until",
  "once",
  "since",
  "while",
]);
export interface TemporalFrame {
  id: number;
  tokens: Token[];
  start: number;
  end: number;
  event?: VerbChain;
  section: string;
  introducer?: string;
}
export interface TemporalRelation {
  kind: string;
  subordinate: number;
  main: number;
}
export interface TemporalDocument {
  frames: TemporalFrame[];
  relations: TemporalRelation[];
  quoted: { start: number; end: number }[];
}
const sectionNames = new Set([
  "methods",
  "materials and methods",
  "results",
  "discussion",
  "introduction",
  "conclusions",
]);
/** A shallow temporal discourse representation. Only explicit links are recorded;
 * adjacent sentences are never assumed to describe the same event/time. */
export function temporalFrames(text: string): TemporalDocument {
  const quoted = [...text.matchAll(/“[^”]*”|"[^"]*"/gu)].map((m) => ({
    start: m.index!,
    end: m.index! + m[0].length,
  }));
  const frames: TemporalFrame[] = [],
    relations: TemporalRelation[] = [];
  let section = "unspecified";
  const add = (tokens: Token[], introducer?: string): number => {
    const id = frames.length;
    const frame: TemporalFrame = {
      id,
      tokens,
      start: tokens[0]?.start ?? 0,
      end: tokens.at(-1)?.end ?? 0,
      section,
      introducer,
    };
    let body = tokens;
    if (introducer === "by the time") body = tokens.slice(3);
    else if (introducer) body = tokens.slice(1);
    // Leading temporal adjuncts have no predicate; the comma belongs to the frame.
    const comma = body.findIndex((t) => t.word === ",");
    if (comma >= 0 && !body.slice(0, comma).some((t) => finiteCandidate(t)))
      body = body.slice(comma + 1);
    while (adverbs.has(body[0]?.lower)) body = body.slice(1);
    const s = subject(body);
    if (s) frame.event = verbChain(body, s.verbIndex);
    if (!frame.event) {
      // The agreement parser deliberately avoids past verbs before objects.
      // For temporal observation, a complete NP followed by a known past form
      // and an explicit complement can supply a past event without editing it.
      for (let i = 1; i < body.length; i++) {
        const v = verb(body[i].lower),
          next = body[i + 1];
        if (
          !v ||
          v.past !== body[i].lower ||
          !next ||
          !(
            [
              "the",
              "a",
              "an",
              "this",
              "these",
              "those",
              "our",
              "it",
              "them",
            ].includes(next.lower) || /^\d/.test(next.word)
          )
        )
          continue;
        const prefix = subject(body.slice(0, i + 1));
        if (prefix?.verbIndex === i) {
          frame.event = verbChain(body, i);
          break;
        }
      }
    }
    // Stative lexemes outside the form-correction lexicon are observed only when
    // a finite be auxiliary follows an explicit pronoun/determiner NP.
    if (!frame.event && body.length > 2) {
      const i = body.findIndex(
        (t, i) => i > 0 && ["am", "is", "are", "was", "were"].includes(t.lower),
      );
      if (
        i > 0 &&
        i <= 6 &&
        !body.slice(0, i).some((t) => temporalIntroducers.has(t.lower))
      )
        frame.event = verbChain(body, i);
    }
    if (
      frame.event &&
      quoted.some(
        (q) => frame.event!.start >= q.start && frame.event!.start < q.end,
      )
    )
      frame.event = undefined;
    frames.push(frame);
    return id;
  };
  for (const line of text.matchAll(/[^\n]+/g)) {
    const label = line[0].trim().replace(/:$/, "").toLowerCase();
    if (sectionNames.has(label)) {
      section = label;
      continue;
    }
    for (const segment of new Intl.Segmenter("en", {
      granularity: "sentence",
    }).segment(line[0])) {
      const t = tokenize(segment.segment, line.index! + segment.index);
      if (!t.length) continue;
      const parts: Token[][] = [];
      let start = 0;
      for (let i = 0; i < t.length; i++)
        if (
          t[i].word === ";" ||
          (t[i].word === "," && ["and", "but", "yet"].includes(t[i + 1]?.lower))
        ) {
          parts.push(t.slice(start, i));
          start = i + (t[i].word === "," ? 2 : 1);
        }
      parts.push(t.slice(start));
      for (const part of parts) {
        const byTime =
          part[0]?.lower === "by" &&
          part[1]?.lower === "the" &&
          part[2]?.lower === "time";
        const initial = byTime
          ? "by the time"
          : temporalIntroducers.has(part[0]?.lower)
            ? part[0].lower
            : undefined;
        const comma = part.findIndex((t) => t.word === ",");
        if (initial && comma > 0) {
          const subordinate = add(part.slice(0, comma), initial),
            main = add(part.slice(comma + 1));
          relations.push({ kind: initial, subordinate, main });
          continue;
        }
        // Embedded interrogatives (know/report/ask whether/when) are not adverbial
        // temporal clauses. Noninitial links are used only for attachment boundaries.
        const link = part.findIndex(
          (t, i) => i > 1 && temporalIntroducers.has(t.lower),
        );
        if (link > 0) {
          const main = add(part.slice(0, link)),
            subordinate = add(part.slice(link), part[link].lower);
          relations.push({ kind: part[link].lower, subordinate, main });
        } else add(part, initial);
      }
    }
  }
  return { frames, relations, quoted };
}
export function subsequentVerb(t: Token[], event: VerbChain, at: number) {
  return t.some(
    (tok) => tok.start > event.end && tok.end <= at && !!verb(tok.lower),
  );
}
