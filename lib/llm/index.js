// Provider-agnostic LLM layer.
// Adding a new provider = drop a file in this dir and register it below.

import { OpenAIProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';

const REGISTRY = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
};

export function createLLM(config) {
  const ProviderClass = REGISTRY[config.provider];
  if (!ProviderClass) {
    throw new Error(`Unknown LLM provider: ${config.provider}. Available: ${Object.keys(REGISTRY).join(', ')}`);
  }
  if (ProviderClass.isAvailable && !ProviderClass.isAvailable()) {
    throw new Error(`${config.provider} provider is not available in this build yet.`);
  }
  return new ProviderClass(config);
}

export function listProviders() {
  return Object.entries(REGISTRY)
    .filter(([, ProviderClass]) => !ProviderClass.isAvailable || ProviderClass.isAvailable())
    .map(([name]) => name);
}

// The canonical classification schema — every provider returns this shape.
export const CLASSIFICATION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'criterion', 'confidence', 'reason',
    'event_title', 'event_date',
    'event_id', 'event_summary',
    'secondary_criterion', 'evidence_type', 'notes',
    'is_letter', 'letter_type',
    'signer_name', 'signer_title',
  ],
  properties: {
    criterion: {
      type: 'string',
      enum: [
        '01 — Awards & Recognition',
        '02 — Memberships',
        '03 — Published Material',
        '04 — Judging',
        '05 — Original Contributions',
        '06 — Authorship',
        '07 — Exhibitions',
        '08 — Leading Critical Role',
        '09 — High Salary',
        '10 — Commercial Success',
        '11 — Comparable Evidence',
        '_Unclassified',
      ],
    },
    confidence: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    reason: { type: 'string', description: 'One sentence quoting or paraphrasing the file content.' },
    event_title: {
      type: ['string', 'null'],
      description: 'Short title that groups files describing the same real-world event. Null if not applicable.',
    },
    event_date: {
      type: ['string', 'null'],
      description: 'Month-year of the actual event when possible (for example "Oct 2025"). May also use issued_<MonYYYY>, start_<MonYYYY>, or a short range when supported by the file.',
    },
    event_id: {
      type: ['string', 'null'],
      description: 'Reusable kebab-case slug for the underlying real-world event, such as "icida-2025-care-path-talk".',
    },
    event_summary: {
      type: ['string', 'null'],
      description: 'One or two sentences explaining the event, the beneficiary role, and why it matters.',
    },
    secondary_criterion: {
      type: ['string', 'null'],
      enum: [
        '01 — Awards & Recognition',
        '02 — Memberships',
        '03 — Published Material',
        '04 — Judging',
        '05 — Original Contributions',
        '06 — Authorship',
        '07 — Exhibitions',
        '08 — Leading Critical Role',
        '09 — High Salary',
        '10 — Commercial Success',
        '11 — Comparable Evidence',
        '_Unclassified',
        null,
      ],
      description: 'Only set when the same event independently supports a second EB1A criterion.',
    },
    evidence_type: {
      type: ['string', 'null'],
      enum: [
        'invitation',
        'acceptance',
        'certificate',
        'thank_you',
        'recommendation_letter',
        'referral_letter',
        'program_agenda',
        'roster_or_profile_screenshot',
        'media_coverage',
        'output_artifact',
        'payment_proof',
        'appointment_or_offer_letter',
        'internal_attestation',
        'other',
        null,
      ],
      description: 'What kind of evidence this specific file is within the larger event bundle.',
    },
    notes: {
      type: ['string', 'null'],
      description: 'Optional notes about date precedence, event matching, ambiguity, de-duplication, or human follow-up.',
    },
    is_letter: { type: 'boolean', description: 'True if this is a signed reference / recommendation letter about the beneficiary.' },
    letter_type: {
      type: ['string', 'null'],
      enum: ['independent', 'dependent', 'citation', null],
      description: 'Only set when is_letter=true. Independent: no prior relationship. Dependent: former employer/mentor/colleague. Citation: signer has cited beneficiary\'s work.',
    },
    signer_name: { type: ['string', 'null'] },
    signer_title: { type: ['string', 'null'] },
  },
};

export const DEFAULT_PROMPT_SECTIONS = {
  role: `You are an EB1A petition evidence analyst. For each file provided, identify the underlying real-world event it documents, then map that event to the appropriate criterion under 8 C.F.R. § 204.5(h)(3). Events are the reusable atomic unit: multiple files (invitation, certificate, thank-you email, recommendation letter, screenshot, etc.) often support the same event and must be bundled together.`,
  classificationTask: `Event before criterion. Always identify the event first, then classify the event under the best-fitting EB1A criterion. The event is reusable across many evidence files, so prefer stable event naming and de-duplication over file-by-file one-off labels.`,
  inputs: `Inputs:
- A single file's extracted content (text, OCR, metadata).
- Optionally, a list of previously identified event_id values for de-duplication.`,
  procedure: `Two-Pass Procedure

Pass 1 — Event Identification
Identify the discrete real-world occurrence the file documents. Examples: a conference talk delivered, a peer-review assignment completed, an award conferred, a panel judged, a media interview given, a paper published, a role or appointment held.

Emit:
- event_id — short kebab-case slug (example: icida-2025-care-path-talk)
- event_title — concise human-readable event name suitable for folder bundling
- event_date — month and year the event actually occurred when possible (example: Oct 2025). If only issuance date is available, use issued_<MonYYYY>. For ongoing roles, use start_<MonYYYY> or a short supported range.
- event_summary — one or two sentences: what happened, the beneficiary's role, and why it matters.

If the file likely matches an existing event_id, reuse it and explain the match in notes.

Pass 2 — Criterion Classification
Map the event to the best-fitting primary criterion. Add secondary_criterion only if the evidence independently supports it.`,
  criteriaReference: `Criteria reference:
  01 — Awards & Recognition: nationally/internationally recognized prizes or awards for excellence.
  02 — Memberships: associations requiring outstanding achievements judged by experts.
  03 — Published Material: material ABOUT the beneficiary in professional/trade publications or major media.
  04 — Judging: participation as a judge of the work of others (peer review, hackathon judging, jury panels).
  05 — Original Contributions: original scientific/scholarly/business contributions of major significance (patents, novel methods, cited work).
  06 — Authorship: scholarly articles BY the beneficiary in professional publications or major media.
  07 — Exhibitions: display of artistic work at exhibitions or showcases.
  08 — Leading Critical Role: leading or critical role for a distinguished organization (title + scope of impact).
  09 — High Salary: high salary or remuneration compared to peers in the field.
  10 — Commercial Success: commercial successes in the performing arts.
  11 — Comparable Evidence: strong EB1A-relevant evidence that does not fit 1–10.
  _Unclassified: ambiguous, irrelevant, or insufficient to classify — do not force-fit.`,
  evidenceTypeTaxonomy: `Evidence type taxonomy for the current file within the event:
invitation · acceptance · certificate · thank_you · recommendation_letter · referral_letter · program_agenda · roster_or_profile_screenshot · media_coverage · output_artifact · payment_proof · appointment_or_offer_letter · internal_attestation · other`,
  letterRules: `If the file is a signed letter ABOUT the beneficiary (recommendation, support letter), set is_letter=true and classify letter_type:
  - "independent": signer has no personal or professional relationship with the beneficiary
  - "dependent": signer is/was an employer, manager, doctoral advisor, mentor, or close collaborator
  - "citation": signer has cited the beneficiary's published work in their own publications (regardless of relationship)`,
  eventRules: `Use event_title as the visual bundle name for subfolders. Make it short, descriptive, and reusable across many files tied to the same event. Prefer one stable event_title per event_id.

Date precedence: actual event date > document issuance date > file metadata date. When not obvious, explain which date source was used in notes.`,
  decisionStyle: `Rules:
- De-duplicate aggressively. Prefer reusing an existing event_id over inventing a new one.
- One primary criterion per event. Add a secondary only when the evidence independently satisfies it.
- Anchor every classification in concrete file content such as names, organizations, dates, titles, and quantified outcomes.
- Criterion 11 is a last resort.
- "_Unclassified" is honest, not lazy. Never force-fit weak evidence.
- No invented facts. If a field cannot be supported by the file, leave it null and explain in notes.`,
  userTemplate: `Filename: {{filename}}

Content:
{{content}}`,
};

export const PROMPT_SECTION_META = {
  role: { label: 'Role', hint: 'Defines the model persona and job.' },
  classificationTask: { label: 'Classification Task', hint: 'Core task instructions for EB1A file classification.' },
  inputs: { label: 'Inputs', hint: 'What context the model should assume is available for each file.' },
  procedure: { label: 'Two-Pass Procedure', hint: 'How event identification and criterion classification should happen.' },
  criteriaReference: { label: 'Criteria Reference', hint: 'Detailed description of each EB1A criterion.' },
  evidenceTypeTaxonomy: { label: 'Evidence Type Taxonomy', hint: 'Allowed evidence_type values for a file inside an event bundle.' },
  letterRules: { label: 'Letter Rules', hint: 'How recommendation and citation letters should be handled.' },
  eventRules: { label: 'Event Rules', hint: 'How event titles and dates should be extracted.' },
  decisionStyle: { label: 'Decision Style', hint: 'How conservative or aggressive the classifier should be.' },
  userTemplate: { label: 'User Template', hint: 'Per-file input template. Use {{filename}} and {{content}}.' },
};

export const DEFAULT_SYSTEM_PROMPT = assembleSystemPrompt(DEFAULT_PROMPT_SECTIONS);
export const DEFAULT_USER_PROMPT_TEMPLATE = DEFAULT_PROMPT_SECTIONS.userTemplate;

export const DEFAULT_PROMPTS = {
  sections: DEFAULT_PROMPT_SECTIONS,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
};

export function resolvePrompts(overrides = {}) {
  const sections = {
    ...DEFAULT_PROMPT_SECTIONS,
    ...(overrides.sections || {}),
  };
  if (!overrides.sections && overrides.systemPrompt) {
    sections.role = overrides.systemPrompt;
  }
  if (!overrides.sections && overrides.userPromptTemplate) {
    sections.userTemplate = overrides.userPromptTemplate;
  }
  return {
    sections,
    systemPrompt: assembleSystemPrompt(sections),
    userPromptTemplate: sections.userTemplate || DEFAULT_USER_PROMPT_TEMPLATE,
  };
}

export function assembleSystemPrompt(sections) {
  return [
    sections.role,
    sections.classificationTask,
    sections.inputs,
    sections.procedure,
    sections.criteriaReference,
    sections.evidenceTypeTaxonomy,
    sections.letterRules,
    sections.eventRules,
    sections.decisionStyle,
  ].filter(Boolean).join('\n\n');
}

export function buildUserPrompt(filename, text, template = DEFAULT_USER_PROMPT_TEMPLATE, extraContext = '') {
  // Compact extraction already trims aggressively; keep a hard cap as a final safeguard.
  const MAX_CHARS = 3200;
  const truncated = text.length > MAX_CHARS;
  const body = truncated ? text.slice(0, MAX_CHARS) + '\n\n[…content truncated for classification…]' : text;
  const prompt = template
    .replaceAll('{{filename}}', filename)
    .replaceAll('{{content}}', body);
  return extraContext ? `${prompt}\n\n${extraContext}` : prompt;
}
