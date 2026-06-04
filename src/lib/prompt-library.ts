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
  "Original upload-folder names and nested folder names are organizational hints. Preserve them when they clearly describe a project, dossier, event, or work stream, but do not treat folder text as a proven fact if the document content conflicts.",
  "Treat this as evidence preparation, not EB1A categorization.",
  "shortSummary should be crisp and easy to scan in a dashboard.",
  "detailedSummary should explain what the document is and what it appears to prove.",
  "evidenceValue should explain why the document may matter in the broader evidence record without giving legal advice.",
  "recommendedUse should suggest how the evidence may be organized, grouped, or referenced in later review steps.",
].join(" ");

export const PRE_FOLDER_AWARE_SUMMARY_PROMPT_TEMPLATE = [
  "You review a single evidence file in a candidate evidence workspace.",
  "The candidate at the center of this review is {{candidateName}}.",
  "Write every summary from the candidate's point of view: explain what the file says about the candidate, the candidate's work, the candidate's participation, or the candidate's recognition.",
  "Treat this as evidence preparation, not EB1A categorization.",
  "shortSummary should be crisp and easy to scan in a dashboard.",
  "detailedSummary should explain what the document is and what it appears to prove.",
  "evidenceValue should explain why the document may matter in the broader evidence record without giving legal advice.",
  "recommendedUse should suggest how the evidence may be organized, grouped, or referenced in later review steps.",
].join(" ");

export const LEGACY_BUNDLING_PROMPT_TEMPLATE = [
  "You organize completed evidence documents into real-world event bundles for {{candidateName}}.",
  "An event can be a project, product, platform, initiative, speaking engagement, judging assignment, authorship effort, award cycle, leadership role, press mention, or other real-world work stream.",
  "Each completed document must end up in exactly one event bundle.",
  "Use the most specific bundle name possible and keep it short.",
  "Do not add year or month to the bundle name because the system prefixes dates automatically.",
  "Never use raw folder paths, upload directory names, or long filename fragments as bundle names.",
  "Do not use generic names like Photograph, Leadership Role, Original Contributions, Event, Project, Supporting Evidence, or Work Stream when the document digest already points to a specific project, product, platform, or initiative.",
  "If the document digest includes structured bundle hints such as role prefixes, suggested bundle names, aliases, or bundle rationale, treat them as strong anchors.",
  "Structured Critical Role, Leading Role, and Original Contribution dossiers should anchor project-specific bundles rather than generic role bundles.",
  "When the digest provides a structured role prefix, preserve it in the bundle name using the exact forms CR, LR, or OC.",
  "For example, prefer CR <initiative>, LR <initiative>, or OC <initiative> over generic titles.",
  "If a structured dossier references multiple initiatives, choose the dominant initiative for that dossier's primary bundle instead of falling back to a generic role name.",
  "Supporting emails, screenshots, newsletters, badges, recommendation letters, and release notes should be merged into the same underlying bundle when the aliases, acronyms, organizations, dates, or subject matter clearly align.",
  "Do not categorize in EB1A terms.",
  "If a document does not clearly belong with others, create a single-document event.",
  "Return strict JSON only.",
].join(" ");

export const DEFAULT_BUNDLING_PROMPT_TEMPLATE = [
  "You organize evidence documents into real-world events or work streams.",
  "An event can be a project, speaking event, judging assignment, authorship effort, book, award, leadership role, press mention, email thread, or other relevant real-world grouping.",
  "Original upload-folder names and nested folder labels are important organizational hints. Use them to keep related files together when they align with the evidence summaries.",
  "Preserve meaningful folder labels as bundle anchors when they clearly represent a real project, product, event, dossier, or work stream, but never return raw folder paths as final bundle names.",
  "Bundle invitations, confirmations, thank-you notes, certificates, recommendation letters, screenshots, and other evidence that clearly belong to the same underlying event.",
  "Photographs, badges, screenshots, attendee lists, and other supporting visuals should be merged into the same underlying event when the organizations, people, dates, or subject matter align.",
  "Do not create a separate generic Photograph or Image bundle if the file is clearly supporting an event already represented elsewhere.",
  "Each completed document must belong to exactly one event bundle.",
  "Use the most specific, human-readable bundle name possible.",
  "Bundle names must be short labels, ideally two to six words.",
  "Do not include year or month in the bundle name because the system adds that prefix automatically.",
  "Do not categorize or reason in EB1A terms.",
  "If a document does not clearly belong with others, create a single-document event.",
  "Return strict JSON only.",
].join(" ");

export const PRE_FOLDER_AWARE_BUNDLING_PROMPT_TEMPLATE = [
  "You organize evidence documents into real-world events or work streams.",
  "An event can be a project, speaking event, judging assignment, authorship effort, book, award, leadership role, press mention, email thread, or other relevant real-world grouping.",
  "Bundle invitations, confirmations, thank-you notes, certificates, recommendation letters, screenshots, and other evidence that clearly belong to the same underlying event.",
  "Photographs, badges, screenshots, attendee lists, and other supporting visuals should be merged into the same underlying event when the organizations, people, dates, or subject matter align.",
  "Do not create a separate generic Photograph or Image bundle if the file is clearly supporting an event already represented elsewhere.",
  "Each completed document must belong to exactly one event bundle.",
  "Use the most specific, human-readable bundle name possible.",
  "Bundle names must be short labels, ideally two to six words.",
  "Do not include year or month in the bundle name because the system adds that prefix automatically.",
  "Do not categorize or reason in EB1A terms.",
  "If a document does not clearly belong with others, create a single-document event.",
  "Return strict JSON only.",
].join(" ");

export const LEGACY_CLASSIFICATION_PROMPT_TEMPLATE = [
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

export const PHASED_CLASSIFICATION_PROMPT_TEMPLATE = [
  "You classify completed event bundles in a candidate evidence workspace into U.S. EB1A criteria.",
  "The candidate at the center of this review is {{candidateName}}.",
  "You are classifying bundle-level events or work streams, not isolated files.",
  "Use the criterion catalog exactly as provided: {{criteriaCatalog}}.",
  "First decide whether the bundle is genuinely probative for any EB1A criterion at all.",
  "If the bundle is too ambiguous, too weak, too mixed, or not clearly appropriate for any criterion, leave the primary criterion empty and explain why it belongs in human review.",
  "Choose one primary criterion only when the bundle's core theory is clear and the supporting evidence is substantial.",
  "Use at most two secondary criteria and only when the same bundle plausibly supports them without stretching.",
  "Do not force uncertain evidence into a legal bucket just to avoid unclassified review.",
  "Be conservative with routine employment materials, internal-only project updates, generic team collaboration evidence, and ordinary delivery milestones. Those often belong in human review instead of a forced legal bucket.",
  "For criterion (v) Original Contributions, look for evidence of novel technical or substantive contributions plus meaningful significance, adoption, measurable impact, or credible expert validation beyond ordinary implementation.",
  "For criterion (viii) Leading or Critical Role, look for responsibility for a distinguished organization, major platform, or consequential business function, not merely participation on a project team.",
  "For criterion (iv) Judging, look for judging, peer review, panel evaluation, selection, or review responsibilities over the work of others.",
  "For criterion (iii) Published Material, look for coverage about the candidate or the candidate's work in publications or media, not the candidate's own authored work unless the bundle is actually about press coverage.",
  "For criterion (vi) Authorship, look for articles, books, white papers, scholarly or professional publications, or comparable authored material credited to the candidate.",
  "For criteria (i), (ii), (vii), (ix), (x), and (xi), require bundle-specific support rather than broad career impressions.",
  "Do not use EB1A criteria as a proxy for bundle naming. Keep the reasoning tied to what the bundle actually proves.",
  "Write rationale for a case-prep reviewer, not legal advice.",
  "suggestedExhibitTitle should be concise, human-readable, and usable for downstream folder organization.",
].join(" ");

export const DEFAULT_CLASSIFICATION_PROMPT_TEMPLATE = [
  "You classify event bundles in a candidate evidence workspace into U.S. EB1A criteria.",
  "The candidate at the center of this review is {{candidateName}}.",
  "You are classifying bundle-level events, not isolated files.",
  "Original upload-folder and dossier names are organizational hints. Consider them when they align with the bundle evidence, especially for recommendation-letter, judging, authorship, critical role, and original contribution folders.",
  "Use the criterion catalog exactly as provided: {{criteriaCatalog}}.",
  "Choose one primary criterion when the bundle clearly fits.",
  "Use secondary criteria sparingly and only when they are genuinely plausible.",
  "If a bundle is too ambiguous, too weak, or not clearly appropriate for any criterion, leave the primary criterion empty and explain why it should go to human review.",
  "Do not force uncertain evidence into a legal bucket just to avoid unclassified review.",
  "Write rationale for a case-prep reviewer, not legal advice.",
  "suggestedExhibitTitle should be concise and human-readable for downstream folder organization.",
].join(" ");

export const PRE_FOLDER_AWARE_CLASSIFICATION_PROMPT_TEMPLATE = [
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
  "The original folder context is: {{folderContext}}.",
  "The document summary context is: {{documentSummary}}.",
  "Tag only the criteria that are genuinely supported by this one document, even if the parent bundle supports more.",
  "Be conservative, avoid inflating evidence across multiple criteria, and prefer pending review when support is weak or ambiguous.",
  "Return a concise keep/pending/archive suggestion based on how usable this one file is in petition drafting.",
].join(" ");

export const PRE_FOLDER_AWARE_TAGGING_PROMPT_TEMPLATE = [
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
  "AI evidence weighting guidance: {{evidenceWeightingBlock}}.",
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
  "{{criterionStructureBlock}}",
  "Strategy memo (excerpted for this criterion): {{strategyMemoBlock}}.",
  "Available evidence (docs tagged for this criterion): {{evidenceBlock}}.",
  "{{stylebookExemplars}}",
  "Pinned exhibits for this criterion: {{pinnedExhibitsBlock}}.",
  "Focused subsection path: {{focusedSubsectionPath}}.",
  "Focused subsection title: {{focusedSubsectionTitle}}.",
  "Focused claim: {{focusedSubsectionSupportsClaim}}.",
  "Comparable evidence rationale, if invoked: {{comparableEvidenceRationale}}.",
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
  return template.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key: string) => {
    return replacements[key] ?? "";
  });
}
