import { it, expect } from "vitest";
import { validateSourceSpan } from "./diagnostics";
import { contextual } from "./contextual";
import { defaults } from "./model";
it("rejects malformed or mismatched ranges instead of relocating an ambiguous occurrence", () => {
  const text = "🧪 usefull usefull";
  expect(validateSourceSpan(text, 3, 10, "usefull")).toBeUndefined();
  expect(validateSourceSpan(text, 2, 9, "usefull")).toBe("source-mismatch");
  expect(validateSourceSpan(text, 0, 0, "")).toBeUndefined();
  for (const [a, b] of [
    [-1, 3],
    [0, 999],
    [4, 3],
    [NaN, 4],
    [0.5, 3],
  ])
    expect(validateSourceSpan(text, a, b, "x")).toBe("invalid-span");
});
it("keeps contextual review narrow, optional, and free of possessive substitutions", () => {
  const s = defaults();
  for (const t of [
    "We live nigh the river.",
    "The end is nigh.",
    "Mi is a musical note.",
    "I visited my uncles last night.",
    "The last nigh unto the gate.",
  ])
    expect(contextual(t, s)).toEqual([]);
  const text = "I wanted to visit mi uncles last nigh";
  expect(contextual(text, s)).toMatchObject([
    { original: "last nigh", replacements: [] },
  ]);
  s.overrides["Time expression review"] = false;
  expect(contextual(text, s)).toEqual([]);
  s.overrides["Time expression review"] = true;
  s.ignoredRules = ["Time expression review"];
  expect(contextual(text, s)).toEqual([]);
});
