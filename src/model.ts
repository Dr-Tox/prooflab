export type Category =
  "Grammar" | "Spelling" | "Punctuation" | "Style" | "Scientific";
export interface TextEdit {
  start: number;
  end: number;
  original: string;
  replacement: string;
}
export interface Issue {
  revision?: number;
  edits?: TextEdit[];
  sources?: string[];
  alternativesConflict?: boolean;
  confidence?: "high" | "medium" | "low";
  terminologyStatus?:
    "known" | "user-approved" | "unknown" | "suspected-misspelling";
  notationOnly?: boolean;
  id: string;
  rule: string;
  category: Category;
  start: number;
  end: number;
  original: string;
  replacements: string[];
  explanation: string;
}
export type Profile =
  "General English" | "Academic English" | "Scientific Writing";
export interface Settings {
  profile: Profile;
  dialect: "US" | "UK";
  siSpace: boolean;
  siSpaceCharacter: "space" | "nbsp";
  unitNotation: "preserve" | "mL";
  overrides: Record<string, boolean>;
  ignoredRules: string[];
  ignoredWords: string[];
  substitutions: { from: string; to: string }[];
  saveDocument: boolean;
}
export const defaults = (): Settings => ({
  profile: "Scientific Writing",
  dialect: "US",
  siSpace: true,
  siSpaceCharacter: "space",
  unitNotation: "preserve",
  overrides: {},
  ignoredRules: [],
  ignoredWords: [],
  substitutions: [],
  saveDocument: false,
});
export const seedWords = [
  "hepatomegaly",
  "hepatotoxicity",
  "nanotoxicology",
  "immunotoxicity",
  "transcriptomics",
  "PFAS",
  "PFHxA",
  "PFBA",
  "PFOA",
  "PFOS",
  "xenobiotic",
  "bioaccumulation",
  "perfluoroalkyl",
  "MYB-NFIB",
];
export const contextualRules: Record<string, string> = {
  "Time expression review":
    "Review the narrow phrase ‘last nigh’ for a possible ‘last night’; no automatic replacement.",
};
export const scientificRules: Record<string, string> = {
  "Repeated words": "Adjacent repeated words (review intentional repetitions).",
  "SI notation":
    "Kelvin and selected SI symbol conventions, without changing values.",
  "SI spacing": "Review a missing space between a value and selected SI units.",
  "Unit consistency": "Review mixed notations for selected units.",
  "Abbreviation consistency":
    "Review case variants of accepted scientific abbreviations.",
  "Academic redundancy":
    "Suggest concise alternatives to selected redundant phrases.",
  "Terminology convention":
    "Review selected terminology without judging scientific correctness.",
  "Preferred terminology":
    "Review your own preferred terminology substitutions.",
};
export function enabled(rule: string, s: Settings, harperDefault = true) {
  if (s.ignoredRules.includes(rule)) return false;
  if (rule in s.overrides) return s.overrides[rule];
  if (
    rule in contextualRules ||
    [
      "Bounded agreement",
      "Existential agreement",
      "Dependent preposition",
      "It contraction",
      "Mass noun agreement",
      "Sentence structure review",
    ].includes(rule)
  )
    return true;
  if (s.profile === "Scientific Writing" && rule.startsWith("Expand"))
    return false;
  if (rule in scientificRules) {
    if (rule === "Terminology convention" || rule === "Unit consistency")
      return false;
    if (rule === "Repeated words" || rule === "Preferred terminology")
      return true;
    if (s.profile === "General English") return false;
    if (s.profile === "Academic English") return rule === "Academic redundancy";
    return true;
  }
  return harperDefault;
}
export function issue(
  rule: string,
  category: Category,
  start: number,
  end: number,
  text: string,
  replacements: string[],
  explanation: string,
): Issue {
  return {
    id: `${rule}:${start}:${end}:${text.slice(start, end)}`,
    rule,
    category,
    start,
    end,
    original: text.slice(start, end),
    replacements,
    explanation,
  };
}
export function overlaps(a: number, b: number, c: number, d: number) {
  return a < d && b > c;
}
export function correctionEdits(
  text: string,
  i: Issue,
  replacement: string,
  currentRevision?: number,
): TextEdit[] {
  if (i.revision !== undefined && currentRevision !== i.revision)
    throw Error(
      "This suggestion belongs to an older document revision. Recheck the document.",
    );
  if (text.slice(i.start, i.end) !== i.original)
    throw Error("This suggestion is stale. Recheck the document.");
  if (!i.replacements.includes(replacement))
    throw Error("This replacement was not offered for the issue.");
  const edits = i.edits
    ? replacement === i.replacements[0]
      ? i.edits
      : []
    : [{ start: i.start, end: i.end, original: i.original, replacement }];
  if (!edits.length) throw Error("Invalid correction transaction.");
  let boundary = text.length;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) {
    if (
      !Number.isInteger(e.start) ||
      !Number.isInteger(e.end) ||
      e.start < 0 ||
      e.end < e.start ||
      e.end > boundary ||
      text.slice(e.start, e.end) !== e.original
    )
      throw Error("Invalid, overlapping or stale correction transaction.");
    boundary = e.start;
  }
  if (i.edits) {
    let projected = i.original;
    for (const e of [...edits].sort((a, b) => b.start - a.start)) {
      if (e.start < i.start || e.end > i.end)
        throw Error(
          "Correction transaction extends beyond its diagnostic span.",
        );
      projected =
        projected.slice(0, e.start - i.start) +
        e.replacement +
        projected.slice(e.end - i.start);
    }
    if (projected !== replacement)
      throw Error(
        "Correction transaction does not match the offered replacement.",
      );
  }
  return edits;
}
export function applyCorrection(
  text: string,
  i: Issue,
  replacement: string,
  currentRevision?: number,
) {
  const edits = correctionEdits(text, i, replacement, currentRevision);
  for (const e of [...edits].sort((a, b) => b.start - a.start))
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  return text;
}
export function applyMany(
  text: string,
  changes: { issue: Issue; replacement: string }[],
  currentRevision?: number,
) {
  const edits = changes
    .flatMap((c) =>
      correctionEdits(text, c.issue, c.replacement, currentRevision),
    )
    .sort((a, b) => b.start - a.start);
  let boundary = text.length;
  for (const e of edits) {
    if (e.end > boundary) throw Error("Overlapping corrections");
    boundary = e.start;
  }
  for (const e of edits)
    text = text.slice(0, e.start) + e.replacement + text.slice(e.end);
  return text;
}
export function parseDictionary(raw: string, format: "txt" | "json") {
  if (raw.length > 1000000)
    throw Error("Dictionary must be smaller than 1 MB.");
  const data: unknown =
    format === "json"
      ? JSON.parse(raw)
      : raw.split(/\r?\n/).filter((w) => w.trim());
  if (
    !Array.isArray(data) ||
    data.some(
      (w) =>
        typeof w !== "string" ||
        !w.trim() ||
        w.trim().length > 100 ||
        /[\r\n\u0000-\u001f]/.test(w),
    )
  )
    throw Error(
      "Use a JSON array of words or one nonempty word per line (maximum 100 characters each).",
    );
  return [...new Set((data as string[]).map((w) => w.trim()))];
}
export function exportDictionary(words: string[], format: "txt" | "json") {
  return format === "json" ? JSON.stringify(words, null, 2) : words.join("\n");
}
