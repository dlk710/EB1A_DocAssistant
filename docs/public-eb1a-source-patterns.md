# Public EB-1A Source Patterns

Setu uses the public-source packet in `docs/EB1A_Public_Sources_for_AI_Petition_Builder.pdf`
as a product-pattern reference, not as petition text to copy. The implementation converts
repeatable successful-petition structures into safer review-by-exception behavior.

## What the sources taught the product

- Successful petition examples consistently organize evidence as an exhibit index, criterion
  map, evidence-to-argument links, and final-merits story.
- Objective records such as judging invitations or completions, publication records,
  compensation records, memberships, award proof, role-impact records, and contribution-impact
  proof are usually easier to route than mixed narrative evidence.
- Reference letters can support multiple theories, especially Original Contributions and
  Leading or Critical Role, so they remain attorney-reviewed.
- Media, exhibitions, and comparable-evidence theories are RFE-prone and remain attorney-reviewed
  even when the model is confident.
- USCIS policy, RFE templates, and AAO non-precedent decisions are used as stress-test and
  gap-detection references, not as approval predictors.

## Product changes

- `data/public-eb1a-sources.json` records the source catalog and usage cautions.
- `data/success-tag-priors.json` records editable source-pattern priors for lower-risk criteria.
- `src/lib/success-patterns.ts` validates and matches those priors against folder names,
  filenames, summaries, metadata previews, and extracted document signals.
- `src/lib/criterion-routing.ts` now allows auto-enable when both the AI model and a public-source
  prior agree, while preserving the existing high-risk and reference-letter guardrails.
- `src/lib/evidence-decisiveness.ts` gives a small load-bearing boost to evidence that matches
  a successful public-source pattern, helping the attorney focus on strategy-strength evidence.
- Summary, tagging, and strategy prompts now ask the AI to separate exhibit-ready evidence from
  administrative, visual-only, duplicative, or weakly probative material.

## Attorney experience

The target attorney workflow is no longer "confirm every tag." Setu should:

- Auto-clear obvious, objective, lower-risk evidence.
- Keep ambiguous, low-confidence, reference-letter, or RFE-prone evidence in human review.
- Surface stronger criteria and anchor documents for strategy brainstorming.
- Maintain reversible AI decisions and attorney override precedence.
- Preserve exclusions and weak evidence reasoning so petition drafting can focus on high-value
  records.

## Guardrails

- Public examples are structural references only; Setu must not copy petition prose.
- Auto-enable still requires at least two agreeing signals.
- Attorney decisions always win over AI re-runs.
- Criteria `03`, `07`, and `11` remain always-human categories.
- Final strategy and petition drafting still require attorney review.
