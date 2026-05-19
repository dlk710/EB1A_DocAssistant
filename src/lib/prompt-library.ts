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
  "You are drafting petition prose for {{candidateName}}'s EB-1A petition.",
  "Section: criterion argument for {{criterionCode}}.",
  "Strategy memo (excerpted for this criterion): {{strategyMemoBlock}}.",
  "Available evidence (docs tagged for this criterion): {{evidenceBlock}}.",
  "{{stylebookExemplars}}",
  "Pinned exhibits for this criterion: {{pinnedExhibitsBlock}}.",
  "Use this section frame: {{sectionKey}}.",
  "HARD RULES:",
  "Every paragraph must reference at least one exhibit.",
  "Do not introduce facts not present in the evidence block.",
  "Do not paraphrase source quotes beyond 15 words. Cite and characterize instead.",
  "Write declaratively. State the claim; let the citation back it.",
  "Do not hedge unless the evidence requires it.",
  "Do not use superlatives unless the source text uses them.",
  "Match the voice and rhythm of the exemplars provided.",
  "Produce a BriefDraft JSON object matching schema {{briefDraftSchema}}.",
  "Write in the voice of an immigration attorney: declarative, evidence-led, sparing on adjectives.",
].join(" ");

export const DEFAULT_STATEMENT_OF_ELIGIBILITY_PROMPT_TEMPLATE = [
  "You are drafting the Statement of Eligibility for {{candidateName}}'s EB-1A petition.",
  "This section opens the petition.",
  "It must identify the petitioner and the basis of the petition under 8 CFR §204.5(h)(3).",
  "It must enumerate the claimed criteria by code and name and state that the threshold is satisfied.",
  "It must briefly frame the lead argument from the locked strategy without repeating full criterion arguments.",
  "Keep the section concise: 150 to 250 words.",
  "Locked strategy: {{lockedStrategyBlock}}.",
  "Approved criterion drafts (abbreviated): {{approvedDraftsBlock}}.",
  "{{stylebookExemplars}}",
  "HARD RULES:",
  "Every claim must reference either an exhibit or an approved per-criterion draft.",
  "Do not characterize claims more strongly than the underlying drafts characterize them.",
  "Do not introduce facts not present in approved drafts or referenced exhibits.",
  "State, do not argue. Detailed arguments live in the criterion sections.",
  "Use declarative voice. No hedging unless the evidence requires it.",
  "Reference 8 CFR §204.5(h)(3) explicitly.",
  "Produce a SynthesisDraft JSON object matching schema {{synthesisSchema}}.",
].join(" ");

export const DEFAULT_FINAL_MERITS_DETERMINATION_PROMPT_TEMPLATE = [
  "You are drafting the Final Merits Determination for {{candidateName}}'s EB-1A petition.",
  "This section closes the petition and must follow the Kazarian two-step structure.",
  "Step one: state that the petitioner satisfies at least three of the ten criteria in 8 CFR §204.5(h)(3), and identify the specific criteria by code and name.",
  "Step two: synthesize across the approved criterion drafts to argue that the totality of the evidence demonstrates sustained national or international acclaim and that the petitioner is among the small percentage at the very top of the field.",
  "Length: 250 to 450 words across three to five paragraphs.",
  "Locked strategy: {{lockedStrategyBlock}}.",
  "Approved criterion drafts (full text): {{approvedDraftsBlock}}.",
  "{{stylebookExemplars}}",
  "HARD RULES:",
  "Every paragraph must reference at least one exhibit or one approved per-criterion draft section.",
  "Do not introduce facts not present in approved drafts or referenced exhibits.",
  "Do not characterize the case more strongly than the underlying drafts characterize it.",
  "Do not cite case law by name unless it is in the workspace as evidence.",
  "Be analytical, not rhetorical.",
  "Avoid superlatives unless the source text uses them.",
  "The Step One paragraph must enumerate the satisfied criteria by code and name.",
  "The Step Two paragraphs must synthesize patterns rather than repeat criterion arguments.",
  "Produce a SynthesisDraft JSON object matching schema {{synthesisSchema}}.",
].join(" ");

export function formatSynthesisSectionLabel(kind: string) {
  return kind === "statement-of-eligibility"
    ? "Statement of Eligibility"
    : kind === "final-merits-determination"
      ? "Final Merits Determination"
      : kind;
}

export function fillPromptTemplate(
  template: string,
  replacements: Record<string, string>,
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? "";
  });
}
