import { writeFileSync } from "node:fs";
import { LocalLinter } from "harper.js";
import { binary } from "harper.js/binary";
import { Proofreader } from "../../src/proofreader";
import { defaults, seedWords } from "../../src/model";
const inputs = [
  "The droplets oscillates rapidly.",
  "The samples that the team collected was analyzed.",
  "She does not agrees the result.",
  "The reagents shows instability.",
  "The results indicates toxicity.",
  "The effect of these compounds are unknown.",
  "The concentrations of PFAS was measured.",
  "Each of the samples were analyzed.",
  "There is several explanations.",
  "The expression of these genes were increased.",
  "The samples that were collected was analyzed.",
  "We did not observed toxicity.",
  "The samples have underwent analysis.",
  "The experiment was conduct yesterday.",
  "The samples were analyze by ELISA.",
  "The researchers has identified three metabolites.",
  "The treatment may reduces inflammation.",
  "The experiment has been conduct twice.",
  "The cells was treated before analysis.",
  "The samples had been store at −80 °C.",
  "The reagents has been analyze.",
  "The signals depends of time.",
  "We have measured the response yesterday.",
  "Previous studies have reported similar findings.",
  "The samples were centrifuged at 3,000 × g.",
  "PFAS are persistent environmental contaminants.",
  "TNF-α and IL-1β were measured by ELISA.",
  "The value was −3.2 mV.",
  "RNA-seq and CYP3A4 were evaluated.",
];
const l = new LocalLinter({ binary }),
  engine = new Proofreader(l, { diagnostics: true });
await engine.initialize();
const rows = [];
for (const text of inputs) {
  const issues = await engine.analyze(text, defaults(), seedWords, 1);
  rows.push({ text, issues, diagnostics: engine.getDiagnostics() });
  console.log(
    JSON.stringify({
      text,
      issues: issues.map((i) => ({
        rule: i.rule,
        original: i.original,
        replacements: i.replacements,
      })),
    }),
  );
}
writeFileSync(
  "benchmark/v2/reports/reproduction-current.json",
  JSON.stringify(
    {
      commit: process.env.SOURCE_COMMIT ?? "working-tree",
      harper: "3.0.0",
      rows,
    },
    null,
    2,
  ) + "\n",
);
await l.dispose();
