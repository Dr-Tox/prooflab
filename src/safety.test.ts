import { beforeAll, afterAll, it, expect } from "vitest";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "./proofreader";
import { defaults, seedWords, issue } from "./model";
import { createScientificPolicy } from "./policy";
const linter = new LocalLinter({ binary }),
  engine = new Proofreader(linter);
beforeAll(() => engine.initialize());
afterAll(() => linter.dispose());
// Promoted round-one findings. These are now development safety regressions, not untouched held-out claims.
it.each([
  "The value was 2 × 10⁻³ mol/L.",
  "The sample was held at 37 °C. The cells were analyzed.",
  "We added 1e−3 mol/L.",
  "We added 5 μg mL⁻¹.",
])("preserves complete measurement tokens: %s", async (text) => {
  expect(await engine.analyze(text, defaults(), seedWords, 1)).toEqual([]);
});
it("does not regard a unit substring as preserving that unit when letters are appended", () => {
  const t = "We used 37 °C.";
  const start = t.indexOf("C.");
  const i = issue("SpellCheck", "Spelling", start, start + 2, t, ["Co"], "");
  expect(createScientificPolicy(t, [], [])(i).issue).toBeUndefined();
});

it("keeps the second-round held-out references frozen", async () => {
  const { readFileSync } = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const frozen = JSON.parse(
    readFileSync(
      new URL("../benchmark/FROZEN-ROUND2.json", import.meta.url),
      "utf8",
    ),
  );
  expect(
    createHash("sha256")
      .update(
        readFileSync(
          new URL("../benchmark/corpus/held-out-round2.json", import.meta.url),
        ),
      )
      .digest("hex"),
  ).toBe(frozen.sha256);
});
