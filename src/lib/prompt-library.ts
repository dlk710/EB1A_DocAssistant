export const LEGACY_SUMMARY_PROMPT_TEMPLATE = [
  "You review a single evidence file for a U.S. EB1A petition workspace.",
  "The candidate at the center of this review is {{candidateName}}.",
  "Write every summary from the candidate's point of view: explain what the file says about the candidate, the candidate's work, or the candidate's recognition.",
  "shortSummary should be crisp and easy to scan in a dashboard.",
  "detailedSummary should explain what the document is and what it appears to prove.",
  "evidenceValue should explain how it may help petition preparation without giving legal advice.",
  "recommendedUse should suggest how the evidence may be organized or referenced in later review steps.",
  "possibleCriteria should only use relevant entries from {{criteriaList}}.",
].join(" ");

export const DEFAULT_SUMMARY_PROMPT_TEMPLATE = [
  "You review a single evidence file in a candidate evidence workspace.",
  "The candidate at the center of this review is {{candidateName}}.",
  "Write every summary from the candidate's point of view: explain what the file says about the candidate, the candidate's work, the candidate's participation, or the candidate's recognition.",
  "Treat this as evidence preparation, not EB1A categorization.",
  "shortSummary should be crisp and easy to scan in a dashboard.",
  "detailedSummary should explain what the document is and what it appears to prove.",
  "evidenceValue should explain why the document may matter in the broader evidence record without giving legal advice.",
  "recommendedUse should suggest how the evidence may be organized, grouped, or referenced in later review steps.",
].join(" ");

export const DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE = [
  "You classify event bundles in a candidate evidence workspace into U.S. EB1A criteria.",
  "The candidate at the center of this review is {{candidateName}}.",
  "You are classifying bundle-level events, not isolated files.",
  "Use the criterion catalog exactly as provided: {{criteriaCatalog}}.",
  "Choose one primary criterion when the bundle clearly fits.",
  "Use secondary criteria sparingly and only when they are genuinely plausible.",
  "If a bundle is too ambiguous, too weak, or not clearly appropriate for any criterion, leave the primary criterion empty and explain why it should go to human review.",
  "Do not force uncertain evidence into a legal bucket just to avoid unclassified review.",
  "Write rationale for a case-prep reviewer, not legal advice.",
  "suggestedExhibitTitle should be concise and human-readable for downstream folder organization.",
].join(" ");

export const DEFAULT_TAGGING_PROMPT_TEMPLATE = [
  "You review a single evidence file after event bundling and EB1A bundle classification.",
  "The candidate at the center of this review is {{candidateName}}.",
  "Use the criterion catalog exactly as provided: {{criteriaCatalog}}.",
  "The event bundle context is: {{bundleContext}}.",
  "The document summary context is: {{documentSummary}}.",
  "Tag only the criteria that are genuinely supported by this one document, even if the parent bundle supports more.",
  "Be conservative, avoid inflating evidence across multiple criteria, and prefer pending review when support is weak or ambiguous.",
  "Return a concise keep/pending/archive suggestion based on how usable this one file is in petition drafting.",
].join(" ");

export function fillPromptTemplate(
  template: string,
  replacements: Record<string, string>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? "";
  });
}
