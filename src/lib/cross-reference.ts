export interface CrossReferenceNormalizationResult {
  text: string;
  exhibitRefs: string[];
  replacements: Array<{ original: string; normalized: string }>;
}

function uniq<T>(values: T[]) {
  return [...new Set(values)];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function canonicalLabel(label: string) {
  return label.replace(/^Ex\.\s*/i, "").trim();
}

export function normalizeExhibitReferences(
  text: string,
  exhibitLabels: string[],
): CrossReferenceNormalizationResult {
  let nextText = text;
  const replacements: Array<{ original: string; normalized: string }> = [];

  exhibitLabels.forEach((label) => {
    const bare = canonicalLabel(label);
    const variants = [
      new RegExp(`\\bexhibit\\s+${escapeRegExp(bare)}\\b`, "gi"),
      new RegExp(`\\bex\\.?\\s*${escapeRegExp(bare)}\\b`, "gi"),
    ];
    variants.forEach((pattern) => {
      nextText = nextText.replace(pattern, (match) => {
        const normalized = `Ex. ${bare}`;
        if (match !== normalized) {
          replacements.push({ original: match, normalized });
        }
        return normalized;
      });
    });
  });

  const exhibitRefs = uniq(
    [...nextText.matchAll(/\bEx\.\s*([0-9]+[A-Z]?)\b/gi)].map((match) => match[1].toUpperCase()),
  );

  return {
    text: nextText,
    exhibitRefs,
    replacements,
  };
}

export function extractCriterionRefs(text: string) {
  return uniq(
    [...text.matchAll(/\(([ivx]+)\)/gi)].map((match) => `(${match[1].toLowerCase()})`),
  );
}
