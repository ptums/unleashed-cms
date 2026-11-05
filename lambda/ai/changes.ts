// The SEO guardrail. On publish, it decides if the page needs new SEO.
// Rule: keep the old SEO, unless there is none, or more than 300 characters of text changed.

// Keys that are not page text the editor wrote.
const SKIP_KEYS = new Set(["id", "seo", "assetId", "alt"]);
const SEO_CHANGE_LIMIT = 300;

// All the text of a page in 1 string, in the same order each time.
export function pageText(value: unknown): string {
  // A string: this is page text.
  if (typeof value === "string") {
    return value;
  }

  // A list: the text of each item.
  if (Array.isArray(value)) {
    return value.map((item) => pageText(item)).join(" ");
  }

  // A number, true/false or null: no text.
  if (typeof value !== "object" || value === null) {
    return "";
  }

  // An object: the text of each value, but not the keys in SKIP_KEYS.
  const parts: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (SKIP_KEYS.has(key)) {
      continue;
    }
    parts.push(pageText(child));
  }
  return parts.join(" ");
}

// How many characters changed between 2 texts.
// It cuts the part at the start that is the same, and the part at the end that is the same.
// What is left in the middle is the change. Example: "a calm day" -> "a busy day" is 4.
export function changedChars(oldText: string, newText: string): number {
  const shorter = Math.min(oldText.length, newText.length);

  let start = 0;
  while (start < shorter && oldText[start] === newText[start]) {
    start++;
  }

  // "start + end < shorter" stops the back count before it runs into the front count.
  let end = 0;
  while (
    start + end < shorter &&
    oldText[oldText.length - 1 - end] === newText[newText.length - 1 - end]
  ) {
    end++;
  }

  return Math.max(oldText.length, newText.length) - start - end;
}

// oldPage is the PUBLISHED record (undefined on the first publish). newPage is the DRAFT.
export function needsSeo(
  oldPage: Record<string, unknown> | undefined,
  newPage: Record<string, unknown>,
): boolean {
  // First publish, or the page has no SEO yet: always make it.
  if (!oldPage || !oldPage.seo) {
    return true;
  }

  return changedChars(pageText(oldPage), pageText(newPage)) > SEO_CHANGE_LIMIT;
}
