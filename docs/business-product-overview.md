# Setu Business And Product Overview

## 1. Product summary

Setu is a local-first immigration evidence platform built to help legal teams move from scattered evidence folders to a structured, reviewable petition-preparation workflow.

Phase 1 changed the product frame from a single workspace tool into a **client-centered lifecycle system**. Phase 2 extended that system into strategy and case-theory commitment. Phase 3 turned that locked theory into controlled petition drafting. Phase 4 completes the working petition path with synthesis and packet assembly:

- a client can have multiple workspaces over time
- the home surface starts with client status, blockers, and recent activity
- the review surface separates urgent human action from routine evidence browsing
- the strategy surface retrieves across the client’s ready workspaces
- the lock stage commits the criteria mix and stable exhibits for later drafting
- the drafting stage produces per-criterion prose with version history, fact-check signals, and attorney style profiles
- the synthesis stage produces Statement of Eligibility and Final Merits Determination sections
- the stitching stage assembles a Bates-numbered packet preview and filable PDF

The current emphasis is still evidence intelligence, review discipline, attorney-guided strategy, and controlled writing, but the product now extends through packet assembly rather than stopping at criterion drafts.

## 2. Core business problem

Petition preparation is slowed down by four recurring failures:

1. evidence lives in unstructured folders
2. the same interpretation work is repeated manually
3. reviewers lose track of what still needs human attention
4. legal organization later loses traceability back to the exact sources

Setu addresses this by layering AI interpretation on top of preserved originals, then surfacing the remaining human decisions clearly.

## 3. Core objective

Setu’s objective is to help a document specialist or attorney reach a review-ready evidence set faster while increasing confidence in:

- what each file is
- why it matters
- how it connects to an initiative or event
- how it contributes to a petition theory
- which items still require human action
- what changed across a client’s lifecycle over time

## 4. Primary users

### Document specialist

The current product is designed first for the specialist who needs to:

- manage one client across multiple work sessions
- upload new evidence folders as they arrive
- inspect AI summaries and bundles
- work through pending human-review items in increments
- keep a clear sense of what has been decided and what has not

### Attorney or strategist

The product also supports a legal reviewer who needs:

- client-level status at a glance
- event and criterion organization
- traceable evidence previews
- override paths without losing AI context
- export-ready structure for downstream drafting
- drafting controls that keep AI prose reviewable instead of opaque

### Future maintainer

Because Setu is evolving quickly, another important user is the next engineer or AI collaborator who must understand the live architecture without reverse-engineering it from the UI.

## 5. Product principles

The product is built around these principles:

1. local-first by default
2. AI-first interpretation, human-final judgment
3. client-centered lifecycle, not just upload-centered workspaces
4. reversible organization layers
5. no silent loss of source traceability
6. dense, readable review UX over decorative empty space

## 6. What Setu is today

Setu is currently a multi-pass evidence workbench wrapped in a client lifecycle shell:

- client portfolio
- client home and recent activity
- workspace intake per client
- document summarization
- event bundling
- bundle-level EB1A classification
- document-level multi-tag criteria suggestions
- evidence-grid review behavior
- manual overrides
- evidence preview
- output packaging
- criterion-level drafting
- synthesis sections
- packet readiness and PDF export
- style profile management

The current product is not just a search tool and not just a document manager. It is a review system built around progressive interpretation and staged human action.

## 7. Value proposition

### Faster intake

Raw folders become organized client workspaces without manual file-by-file triage.

### Better continuity

One client can accumulate multiple workspaces while still presenting a coherent lifecycle view.

### Better traceability

The system preserves:

- original file access
- per-document summaries
- event-level grouping
- criterion-level organization
- timeline events for important actions

### Safer human review

Reviewers can work through pending items intentionally instead of scanning an overwhelming full page to guess what remains unresolved. Documents that are real but not load-bearing can be moved into a Reference state so they stay available without inflating criterion coverage.

### Local control

The app runs locally, stores its state locally, and keeps work isolated per workspace and per client.

## 8. Product workflow

The live operating flow is:

1. create or select a client
2. upload a folder into that client
3. run indexing
4. let Setu summarize documents
5. let Setu bundle evidence into events
6. let Setu classify events into EB1A criteria
7. let Setu tag individual evidence files
8. surface pending human-review items separately
9. review and override evidence in increments
10. generate a client-wide strategy memo and stress-test it
11. lock the criteria mix and stable exhibits
12. draft criterion arguments with style-profile guidance
13. approve criterion drafts
14. synthesize the opening and closing petition sections
15. review packet findings, preview the assembled petition, and generate the filable packet

This is intentionally progressive. Later passes do not erase earlier ones.

## 9. Product surfaces

### Client portfolio

The top-level portfolio is the starting point for active cases and recent history.

### Client home

The client home is the lifecycle summary surface:

- status
- blocking action
- stage strip
- coverage
- spend
- recent activity

### Client review

The client review page is the human-action surface. It is meant to answer:

- what needs my judgment now
- what is routine and can wait
- what has already been reviewed
- what is archived or cleanup-only

The current review UX is a single Evidence Grid:

- one row per document and one criterion column per legal bucket
- visible criterion-cell states for off, suggested, supporting, and primary
- document-level `Reference` and `Archive` toggles
- quick peek for summary, tags, preview text, and source metadata
- filters for workspace, bundle, criterion, disposition, AI-unsure, and search
- bulk actions for tagging, disposition changes, and bundle moves
- autosave with explicit save-state feedback
- bundle grouping preserved only as a convenience filter and review hint, not as the owner of criterion classification

The human-review sequence is intentionally staged:

- decide whether the document remains `tagged`, moves to `reference`, or moves to `archived`
- confirm or correct AI-suggested criterion tags
- use bundle context as a convenience grouping when acting across related evidence

When the reviewer is not ready to make a final bundle or criterion call, Setu exposes an `OTHER` placeholder so the item stays visible without blocking the rest of the case.

### Workspace dashboard

The workspace dashboard remains for operational intake, job progress, and dense workspace intervention.

It now also reports intake cleanup automatically:

- exact duplicate files are skipped before indexing by checksum
- macOS `.DS_Store` files are auto-archived immediately
- the dashboard shows a simple intake report for indexed, skipped, and auto-archived files

### Strategy stage

The strategy page is where the attorney or strategist decides:

- which criteria are worth claiming
- which criteria are supporting only
- where the case is thin or risky
- what the lead narrative spine should be

Ask Setu supports this stage through `Triage`, `Strategy`, and `Stress-test`.

### Lock stage

The lock stage turns a strategic theory into durable drafting inputs:

- stable exhibit labels
- accepted and declined criteria
- narrative spine
- per-criterion pinboards

### Drafting stage

The drafting stage is the production-writing surface:

- one queue across all locked criteria
- one drafting workspace per criterion with a recursive subsection tree
- subsection-level generation, editing, version history, and approval
- verbatim endorsement-quote extraction and acceptance for sub-claims
- style-profile-driven Draft mode that follows the focused subsection
- comparable-evidence drafting as a first-class mode
- fact-check and generic-prose warnings before approval
- attorney-selected exhibit numbering schemes locked before drafting begins

### Synthesis stage

The synthesis stage is where Setu turns approved criterion arguments into petition-level analytical sections:

- Statement of Eligibility
- Final Merits Determination
- synthesis-specific fact-checking against exhibits and approved criterion drafts
- synthesis-aware Draft mode in Ask Setu

### Stitching stage

The stitching stage is where Setu assembles the filing packet:

- cover sheet and table of contents
- synthesis sections and approved criterion arguments
- exhibit index and exhibits
- packet-level findings
- Bates ranges
- preview and filable PDF generation

## 10. Experience goals

The intended experience is:

- calm rather than noisy
- dense but readable
- actionable over ornamental
- client-centered rather than upload-centered
- safe for review work spread over multiple sessions or days

Important UX guardrails already established:

- pending human-review items must be easy to isolate
- actioned evidence must disappear from pending queues immediately
- large dead areas are regressions
- prompt editing must be scrollable
- context menus must not open off-screen
- dense operational surfaces must remain available for power users

## 11. Non-goals for the current branch

The current branch is not trying to become:

- a fully autonomous final petition author
- a generic enterprise DMS
- a multi-tenant cloud collaboration platform
- a final end-to-end petition lifecycle suite

Still deferred beyond the current branch:

- collaborative redlines and live co-editing
- USCIS filing integration
- packet variant management across refilings
- multi-petition-type expansion beyond EB-1A

The current scope now reaches assembled packet preview and filable PDF generation, but not filing itself.

## 12. Success indicators

Useful signals for this stage:

- faster movement from upload to review-ready client state
- fewer missed pending review items
- lower confusion about what needs human action next
- better continuity across multiple uploads for the same client
- preserved traceability into downstream drafting
- drafts that require less attorney rewriting before approval
- fewer factual drift issues reaching the attorney after draft generation
- a drafting workflow that stays criterion-scoped and manageable instead of overwhelming
- synthesis sections that are edit-quality instead of rewrite-quality
- packet previews that surface filing blockers before export rather than after

## 13. Operational posture

Setu remains intentionally conservative in three places:

- it keeps originals intact
- it isolates workspaces
- it exposes override paths instead of hiding AI uncertainty

That posture matters more than making the system feel magically automatic.

## 14. Brand posture

The user-facing product brand is `setu`, presented through a charcoal-and-amber visual system. Some internal filenames or older branch history still reflect earlier naming, but current product and documentation should use Setu.
