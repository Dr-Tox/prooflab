import { enabled, issue, type Settings } from "./model";
const units =
  "(?:°[CK]|K|kg|mg|[µμu]g|ng|g|mL|ml|L|mmol|mol|ms|min|sec|s|h|nm|mm|cm|m|mS|Pa|kPa|Hz|N|J|W|V|A)";
export function measurementSpans(text: string) {
  const exponent = "(?:\\^[−-]?\\d+|[⁻⁺⁰¹²³⁴⁵⁶⁷⁸⁹]+)?";
  return [
    ...text.matchAll(
      new RegExp(
        `[−-]?\\d+(?:\\.\\d+)?[ \\u00a0]*${units}${exponent}(?:[/*·]${units}${exponent})*(?![\\p{L}\\p{N}_])`,
        "gu",
      ),
    ),
  ].map((m) => ({ start: m.index!, end: m.index! + m[0].length, text: m[0] }));
}
export function measurementIssues(text: string, s: Settings) {
  const out = [];
  for (const m of measurementSpans(text)) {
    const value = /^([−-]?\d+(?:\.\d+)?)([ \u00a0]*)(.*)$/u.exec(m.text)!;
    const [, , space, unit] = value;
    const separator = s.siSpaceCharacter === "nbsp" ? "\u00a0" : " ";
    if (unit.startsWith("°K") && enabled("SI notation", s)) {
      const start = space ? m.start + value[1].length + space.length : m.start;
      out.push({
        ...issue(
          "SI notation",
          "Scientific",
          start,
          m.end,
          text,
          [
            space
              ? unit.replace(/^°K/, "K")
              : value[1] + separator + unit.replace(/^°K/, "K"),
          ],
          "Kelvin uses K without a degree sign. Keep the numerical value unchanged.",
        ),
        notationOnly: true,
      });
    } else if (!space && s.siSpace && enabled("SI spacing", s))
      out.push({
        ...issue(
          "SI spacing",
          "Scientific",
          m.start,
          m.end,
          text,
          [value[1] + separator + unit],
          "Use a space between the numerical value and the unit symbol. The number is unchanged.",
        ),
        notationOnly: true,
      });
    if (
      s.unitNotation === "mL" &&
      /\bml\b/.test(unit) &&
      enabled("Unit consistency", s)
    )
      out.push({
        ...issue(
          "Unit consistency",
          "Scientific",
          m.start,
          m.end,
          text,
          [value[1] + (space || separator) + unit.replace(/\bml\b/g, "mL")],
          "Your configured volume notation is mL. Other conventions may be valid for a journal.",
        ),
        notationOnly: true,
      });
  }
  return out;
}
