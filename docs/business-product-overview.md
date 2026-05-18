# Setu Business And Product Overview

## 1. Product summary

Setu is a local-first immigration evidence platform built to help legal teams move from scattered evidence folders to a structured, reviewable petition-preparation workflow.

Phase 1 changes the product frame from a single workspace tool into a **client-centered lifecycle system**:

- a client can have multiple workspaces over time
- the home surface starts with client status, blockers, and recent activity
- the review surface separates urgent human action from routine evidence browsing

The current emphasis is still evidence intelligence and review discipline, not autonomous legal drafting.

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
- document-level tagging
- human review inbox behavior
- manual overrides
- evidence preview
- output packaging

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

Reviewers can work through pending items intentionally instead of scanning an overwhelming full page to guess what remains unresolved.

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
9. review, override, and package the results

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

### Workspace dashboard

The workspace dashboard remains for operational intake, job progress, and dense workspace intervention.

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

- a fully autonomous legal drafting engine
- a generic enterprise DMS
- a multi-tenant cloud collaboration platform
- a final end-to-end petition lifecycle suite

Phase 1 is specifically about the client shell and review-action clarity.

## 12. Success indicators

Useful signals for this stage:

- faster movement from upload to review-ready client state
- fewer missed pending review items
- lower confusion about what needs human action next
- better continuity across multiple uploads for the same client
- preserved traceability into downstream drafting

## 13. Operational posture

Setu remains intentionally conservative in three places:

- it keeps originals intact
- it isolates workspaces
- it exposes override paths instead of hiding AI uncertainty

That posture matters more than making the system feel magically automatic.

## 14. Brand posture

The user-facing product brand is `setu`, presented through a charcoal-and-amber visual system. Some internal filenames or older branch history still reflect earlier naming, but current product and documentation should use Setu.
