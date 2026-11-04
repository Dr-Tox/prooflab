export function documentOf(words: number, trial = 0) {
  const paragraph =
    "The samples were centrifuged at 3,000 × g for 30 min. The supernatant was collected after centrifugation. Previous studies have reported similar findings. These findings suggest that exposure may affect metabolism. The potential was −3.2 mV and the temperature was 37 °C. PFAS are persistent environmental contaminants. The response was associated with exposure. We analyzed the samples before the assay began. ";
  const count = paragraph.trim().split(/\s+/).length;
  return (
    paragraph
      .repeat(Math.ceil(words / count))
      .trim()
      .split(/\s+/)
      .slice(0, words)
      .join(" ") + `\nThe trial number was ${trial}.`
  );
}
