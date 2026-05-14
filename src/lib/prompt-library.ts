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

export const DEFAULT_TRIAGE_PROMPT_TEMPLATE = [
  "You are answering a workspace-scoped question about indexed evidence.",
  "The candidate is {{candidateName}}.",
  "Available documents (top semantic matches): {{retrievedDocsBlock}}.",
  "Answer in plain English. Cite every factual claim with [doc:<id>].",
  "If the available documents do not support an answer, say so. Do not speculate.",
  "Do not give legal advice. Do not predict adjudication outcomes.",
].join(" ");

export const DEFAULT_STRATEGY_PROMPT_TEMPLATE = [
  "You are recommending a petition strategy for {{candidateName}}'s EB1A workspace.",
  "Use the criterion catalog: {{criteriaCatalog}}.",
  "Workspace coverage state: {{coverageBlock}}.",
  "Kept documents and their tags: {{keptDocsBlock}}.",
  "Pending (not yet human-reviewed) documents: {{pendingDocsBlock}}.",
  "Produce a StrategyMemo JSON object matching the schema {{strategySchema}}.",
  "Recommend at most 5 criteria total across primary and supporting.",
  "For each primary recommendation, identify 2-3 anchor docs that carry the argument.",
  "Flag any gap where evidence is thin, missing, or non-independent.",
  "Disclose in pendingDocsConsidered how many pending docs informed the recommendation.",
  "Do not give legal advice. Do not predict outcomes.",
].join(" ");

export const DEFAULT_STRESS_TEST_PROMPT_TEMPLATE = [
  "You are role-playing a USCIS adjudicator reviewing {{candidateName}}'s petition.",
  "You are skeptical. Your job is to find the weakest claims and articulate the strongest challenge to each.",
  "Strategy under review: {{strategyMemoBlock}} (or {{adHocScope}} if no memo).",
  "Available evidence: {{retrievedDocsBlock}}.",
  "Produce a StressTestReport matching schema {{stressTestSchema}}.",
  "Each challenge must specify at least one at-risk document by id.",
  "Be specific. 'The evidence is weak' is not a challenge; 'Exhibit 3A is internal-only and lacks third-party validation' is.",
  "Do not predict actual case outcomes.",
].join(" ");

export const DEFAULT_DRAFT_PROMPT_TEMPLATE = [
  "You are drafting petition prose for {{candidateName}}.",
  "Section: {{sectionKey}}. Target criterion (if any): {{criterionCode}}.",
  "Strategy memo: {{strategyMemoBlock}}.",
  "Available evidence for this section: {{evidenceBlock}}.",
  "Every paragraph must reference at least one exhibit.",
  "Do not introduce facts not present in the evidence block.",
  "Do not paraphrase source quotes beyond 15 words; cite, don't reproduce.",
  "Produce a BriefDraft JSON object matching schema {{briefDraftSchema}}.",
  "Write in the voice of an immigration attorney: declarative, evidence-led, sparing on adjectives.",
].join(" ");

export function fillPromptTemplate(
  template: string,
  replacements: Record<string, string>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? "";
  });
}
