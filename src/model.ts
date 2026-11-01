export type Category =
  "Grammar" | "Spelling" | "Punctuation" | "Style" | "Scientific";
export interface Issue {
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
  if (rule in contextualRules) return true;
  if (rule in scientificRules) {
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
export function protectedRanges(text: string): [number, number][] {
  return [
    ...text.matchAll(
      /\b(?:[A-Z][A-Za-z]*[A-Z][A-Za-z0-9]*(?:-[A-Z0-9]+)*|[A-Za-z]+\d+[A-Za-z\d]*|\d+(?:[.,]\d+)?(?:\s*(?:±|[<=>]|%|mg|kg|µg|μg|ng|mL|ml|L|mm|cm|nm|mmol|mol|°C)\s*\d*(?:\.\d+)?)?)\b/g,
    ),
  ].map((m) => [m.index!, m.index! + m[0].length]);
}
export function overlaps(a: number, b: number, c: number, d: number) {
  return a < d && b > c;
}
export function applyCorrection(text: string, i: Issue, replacement: string) {
  if (text.slice(i.start, i.end) !== i.original)
    throw Error("This suggestion is stale. Recheck the document.");
  return text.slice(0, i.start) + replacement + text.slice(i.end);
}
export function applyMany(
  text: string,
  changes: { issue: Issue; replacement: string }[],
) {
  const sorted = [...changes].sort((a, b) => b.issue.start - a.issue.start);
  let boundary = text.length;
  for (const c of sorted) {
    if (c.issue.end > boundary) throw Error("Overlapping corrections");
    text = applyCorrection(text, c.issue, c.replacement);
    boundary = c.issue.start;
  }
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
