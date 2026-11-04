/** Original, manually curated vocabulary; no imported lexicon or runtime download.
 * Sources and maintenance policy: SCIENTIFIC_VOCABULARY.md. Terms are facts/common terminology.
 */
const methods =
  "centrifugation centrifuged centrifuging supernatant supernatants aliquot aliquots resuspension resuspended pipetting pipetted immunohistochemistry immunoblotting electrophoresis chromatography spectrophotometry fluorometry cytometry microscopy polymerase proteomics metabolomics transcriptomics nanotoxicology immunotoxicity hepatotoxicity hepatomegaly xenobiotic xenobiotics bioaccumulation perfluoroalkyl toxicokinetics pharmacokinetics pharmacodynamics cytotoxicity genotoxicity apoptosis autophagy lysate lysates pellet pellets filtrate filtrates analyte analytes organoid organoids hepatocyte hepatocytes cytokine cytokines phosphoprotein phosphorylation dephosphorylation RNA-seq CYP3A4 RNA DNA cDNA mRNA siRNA ATP ADP PCR qPCR RT-PCR ELISA SDS-PAGE PBS DMSO NaCl H2O CO2 O2 PFAS PFHxA PFBA PFOA PFOS MYB-NFIB TNF TNF-α IL IL-1β IL-6 NF NF-κB";
export const scientificVocabulary = methods.split(" ").map((term) => ({
  term,
  caseSensitive: /[A-Zαβκ]/u.test(term),
  type: /[A-Z]/.test(term) ? "identifier" : "terminology",
}));
export function knownScientific(term: string) {
  return scientificVocabulary.some((v) =>
    v.caseSensitive
      ? v.term === term
      : v.term.toLowerCase() === term.toLowerCase(),
  );
}
export function scientificTermSpans(text: string) {
  const out: { start: number; end: number; term: string }[] = [];
  for (const v of scientificVocabulary) {
    const escaped = v.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of text.matchAll(
      new RegExp(escaped, v.caseSensitive ? "gu" : "giu"),
    )) {
      const a = m.index!,
        b = a + m[0].length;
      if (
        !/[\p{L}\p{N}_]/u.test(text[a - 1] ?? "") &&
        !/[\p{L}\p{N}_]/u.test(text[b] ?? "")
      )
        out.push({ start: a, end: b, term: m[0] });
    }
  }
  return out;
}
function distance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, n) => n);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      prev = old;
    }
  }
  return row[b.length];
}
/** Called only on a native spelling finding, never on every unfamiliar-looking word. */
export function technicalCandidate(word: string) {
  if (word.length < 7 || !/^[a-z]+$/i.test(word)) return undefined;
  const scored = scientificVocabulary
    .filter(
      (v) =>
        !v.caseSensitive &&
        v.term.slice(0, 3).toLowerCase() === word.slice(0, 3).toLowerCase(),
    )
    .map((v) => ({ word: v.term, d: distance(word.toLowerCase(), v.term) }))
    .filter((v) => v.d > 0 && v.d <= 2)
    .sort((a, b) => a.d - b.d);
  if (!scored.length || (scored[1] && scored[1].d === scored[0].d))
    return undefined;
  const candidate = scored[0].word;
  return /^[A-Z]/.test(word)
    ? candidate[0].toUpperCase() + candidate.slice(1)
    : candidate;
}

export function scientificCaseVariants(text: string) {
  const out: { start: number; end: number; term: string }[] = [];
  for (const v of scientificVocabulary.filter((v) => v.caseSensitive)) {
    const pattern = v.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of text.matchAll(new RegExp(pattern, "giu"))) {
      const a = m.index!,
        b = a + m[0].length;
      if (
        m[0] !== v.term &&
        !/[\p{L}\p{N}_]/u.test(text[a - 1] ?? "") &&
        !/[\p{L}\p{N}_]/u.test(text[b] ?? "")
      )
        out.push({ start: a, end: b, term: m[0] });
    }
  }
  return out;
}
