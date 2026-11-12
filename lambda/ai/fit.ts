// Cuts text to the limit at the last word break, so a long title never blocks SEO.
// The model is asked twice first. This is only the last step.
export function fitToLimit(text: string, limit: number): string {
  const clean = text.trim();
  if (clean.length <= limit) {
    return clean;
  }
  const cut = clean.slice(0, limit + 1);
  const lastSpace = cut.lastIndexOf(" ");
  const words = lastSpace > 0 ? cut.slice(0, lastSpace) : clean.slice(0, limit);
  // A title should not end on a dash, colon or comma left over from the cut.
  return words.replace(/[\s\-–—:,;|·]+$/u, "");
}
