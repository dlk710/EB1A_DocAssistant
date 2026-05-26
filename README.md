# setu

Setu is a local-first immigration evidence platform that now starts from the **client record**, not just the upload workspace. The product turns raw folder uploads into a structured review system while preserving original files, intermediate AI reasoning layers, and human override paths.

Phase 1 introduced the client lifecycle shell. Phase 2 added the client-wide strategy and lock stages. Phase 3 added criterion-level drafting. Phase 4 completes the petition assembly path with synthesis and stitching:

1. manage clients from a portfolio view
2. open a client home with stage status, spend, coverage, and timeline
3. run isolated evidence workspaces under that client
4. review human-action items separately from routine evidence
5. generate a client-wide strategy memo and stress-test it with Ask Setu
6. lock the case theory into stable exhibit numbering and downstream scaffolding
7. draft per-criterion petition prose with versioning, fact-check signals, and style profiles
8. synthesize approved criterion drafts into Statement of Eligibility and Final Merits Determination sections
9. stitch the approved petition into a Bates-stamped packet preview and filable PDF
10. keep the dense workspace tooling available when deeper intervention is needed

## Core objective

Setu exists to make petition evidence preparation faster, more traceable, and more defensible without turning the process into a black box.

The product contract is:

- local-first by default
- AI-first interpretation, human-final judgment
- reversible organization layers
- one client can accumulate multiple workspaces over time
- original evidence is never modified
- every review decision remains inspectable
- strategy and stress-test outputs remain client-scoped and citable

## Current product scope

The live app at `http://localhost:3001` currently supports:

- client portfolio and client-specific home pages
- folder-based workspace ingestion from the browser
- isolated workspaces per upload, keyed by `jobId`
- OpenAI-powered document summarization
- Qdrant-backed semantic retrieval
- AI event bundling
- AI EB1A bundle classification
- AI document-level multi-tag criteria suggestions
- document dispositions: `untouched`, `tagged`, `reference`, `archived`
- criterion-tag states: `suggested`, `enabled`, `disabled`
- manual overrides for evidence, event bundles, and criteria placement
- client review Evidence Grid with visible criterion slots, quick peek, filters, autosave, and bulk actions
- client-wide strategy workspace with Ask Setu in `Triage`, `Strategy`, `Stress-test`, and `Draft`
- client-scoped strategy memo and stress-test artifacts
- lock and unlock flow with stable exhibits, pinboards, and draft placeholders
- folder-first routing suggestions that preserve uploaded folder, subfolder, and filename context during review
- criterion drafting queue and three-column drafting workspace
- style profiles with a curated default exemplar pack
- draft fact-check and generic-prose checks
- versioned criterion drafts with approval state
- synthesis drafting for Statement of Eligibility and Final Merits Determination
- synthesis-aware Ask Setu Draft mode
- packet assembly, audit findings, Bates pagination, preview, and download
- original-file preview and source access
- prompt editing through Prompt Library
- tracked OpenAI cost by pipeline stage
- local packet preview and filable PDF generation
- intake duplicate detection and automatic `.DS_Store` archiving with an end-of-intake report

## Lifecycle routes

The current surface is client-first:

- `/clients`
  - portfolio view for all clients
- `/clients/<clientId>`
  - client home with lifecycle summary, blockers, coverage, spend, and timeline
- `/clients/<clientId>/review`
  - Evidence Grid review page for that client
- `/clients/<clientId>/strategy`
  - coverage, strategy memo, stress-test, and Ask Setu
- `/clients/<clientId>/lock`
  - lock the criteria mix and exhibit numbering
- `/clients/<clientId>/unlock`
  - reversible unlock flow with invalidation summary
- `/clients/<clientId>/drafting`
  - criterion drafting queue
- `/clients/<clientId>/drafting/<criterionCode>`
  - three-column drafting workspace for one locked criterion
- `/clients/<clientId>/synthesis`
  - Statement of Eligibility and Final Merits Determination workspace
- `/clients/<clientId>/stitching`
  - packet readiness, findings, preview, and filable packet generation
- `/settings/style-profiles`
  - style profile and exemplar management for criterion drafts and synthesis sections
- `/?view=workspace&clientId=<clientId>`
  - dense workspace intake/dashboard preserved for operational work
- `/review/<jobId>`
  - job-level review surface for retrieval-heavy review

When clients exist, `/` redirects to `/clients`.

## Product workflow

The implemented multi-pass pipeline remains:

1. `Indexing`
2. `Bundling`
3. `Classifying`
4. `Tagging`
5. `Ready`

The lifecycle wraps that pipeline in a client model:

1. create or select a client
2. upload a new evidence folder into that client
3. let Setu run the multi-pass AI interpretation flow
4. surface blocking human actions separately from routine evidence
5. review and override in increments across days if needed
6. open the client-wide Strategy stage once review is complete
7. ask follow-up questions, generate a strategy memo, and stress-test the case theory
8. lock the criteria mix and stable exhibits for downstream drafting
9. generate, edit, compare, and approve per-criterion drafts
10. draft and approve the Statement of Eligibility and Final Merits Determination
11. review packet findings, preview the assembled petition, and generate the filable PDF

## Main surfaces

### Client portfolio

The portfolio page is the top-level entry. It is meant for:

- seeing all clients at a glance
- understanding current lifecycle stage
- opening the latest client activity quickly
- creating a new client record

### Client home

The client home is the operational summary for one client. It shows:

- current status and blocking action
- stage strip and workspace counts
- coverage and spend
- recent activity timeline
- latest workspace shortcuts

### Client review page

The client review page is now a single Evidence Grid. It emphasizes:

- items that still require human judgment
- one row per document and one clickable column per criterion
- visible off, suggested-supporting, suggested-primary, supporting, and primary tag states in every criterion cell
- document-level `Reference` and `Archive` toggles
- quick peek side panel with summary, current tags, preview text, and source metadata
- autosave with `Unsaved`, `Saving`, and `Saved` feedback plus an explicit `Save` button
- filters for workspace, bundle, criterion, disposition, AI-unsure, and search
- bulk actions for multi-select tagging, disposition changes, and bundle moves
- bundle grouping preserved as a convenience filter, not as the owner of criterion classification
- a compact fixed-width layout with angled criterion headers so the full grid stays visible without left-right scrolling at standard laptop widths
- a workspace routing setting that can prefer uploaded folder structure first for bundling, classification, and tagging

The review model is now:

- AI proposes criterion tags per document
- AI can suggest those tags as either `supporting` or `primary`
- the attorney enables, disables, or re-roles those tags
- coverage only counts enabled tags on documents whose disposition remains `tagged`
- the dense `/review/<jobId>` surface remains available separately for deeper retrieval-heavy workspace work

### Strategy stage

The strategy page is the Phase 2 hero surface. It combines:

- client-wide coverage at a glance across all ready workspaces
- a structured strategy memo with citations and reasoning
- an inline stress-test report
- Ask Setu chat with four active modes:
  - `Triage`
  - `Strategy`
  - `Stress-test`
  - `Draft`

### Lock stage

The lock page commits the case theory into durable downstream structure:

- primary and supporting criteria with stable exhibit labels
- declined criteria with rationale
- editable narrative spine
- per-criterion pinboards
- draft placeholders and pinboards seeded for drafting
- unlock with invalidation preview

### Drafting stage

The drafting stage is the criterion-level production-writing layer. It adds:

- a drafting queue across all locked criteria
- a recursive drafting workspace with a subsection tree, focused draft pane, and subsection-scoped Ask Setu
- per-subsection AI and human version history inside a criterion-level draft record
- endorsement-quote extraction and acceptance from recommendation letters
- draft approval per subsection, with criterion approval rolling up only when the full tree is approved
- comparable-evidence mode with recorded invoked criterion and rationale
- subtle-drift warnings from the fact-check pass
- generic-prose warnings for common AI phrases
- style-profile-driven Draft generation
- lock-time exhibit numbering schemes with configurable letter maps

### Synthesis stage

The synthesis stage turns approved criterion arguments into the petition's analytical bookends:

- Statement of Eligibility generation and approval
- Final Merits Determination generation and approval
- synthesis-aware fact-checking against approved criterion drafts and exhibits
- synthesis-scoped Ask Setu Draft assistance
- synthesis-specific style exemplar support

### Stitching stage

The stitching stage is the deterministic packet assembly layer. It adds:

- section ordering across cover, TOC, synthesis, criterion arguments, exhibit index, and exhibits
- destructive cross-reference normalization in the assembled output only
- audit findings for missing exhibits, stale references, and packet issues
- Bates numbering across the full packet
- preview and filable packet generation

### Workspace dashboard

The dense workspace surface remains available for:

- intake
- job progress
- bundle and criterion inspection
- deeper workspace-specific review and overrides

### Prompt Library

Prompt Library is a large scrollable modal used to edit the active prompts for:

- document summarization
- bundle classification
- criteria tagging
- Ask Setu chat modes where enabled
- style profile selection for Draft mode
- the routing policy that switches between `Prefer folder structure first` and `Balance folder and content`

Only the active prompt text is stored. Prompt history is intentionally not stored.

## Setu brand direction

Setu uses the v4 charcoal-and-amber identity:

- dominant brand color: charcoal `#1A1A1F`
- primary accent: amber `#BA7517`
- supporting paper tones: warm neutrals for readability

Implementation rules:

- use app-wide tokens from [src/app/globals.css](src/app/globals.css)
- do not add raw hex values in component code unless a token is introduced first
- use amber sparingly for emphasis
- preserve the `setu` wordmark and deck treatment in the application chrome

## Documentation map

- Business and product overview: [docs/business-product-overview.md](docs/business-product-overview.md)
- Phase 1 client lifecycle design: [docs/phase1-client-lifecycle.md](docs/phase1-client-lifecycle.md)
- Phase 2 strategy and lock design: [docs/phase2-strategy-lock.md](docs/phase2-strategy-lock.md)
- Phase 3 drafting design: [docs/phase3-drafting.md](docs/phase3-drafting.md)
- Phase 4 synthesis and stitching design: [docs/phase4-synthesis-stitching.md](docs/phase4-synthesis-stitching.md)
- Technical and system design: [docs/final-design.md](docs/final-design.md)
- Operations and maintenance playbook: [docs/operating-playbook.md](docs/operating-playbook.md)
- Repo-local continuation skill for future AI work: [skills/setu-studio-continuation/SKILL.md](skills/setu-studio-continuation/SKILL.md)

## Repo map

Key implementation files:

- Main UI shell: [src/components/evidence-workbench.tsx](src/components/evidence-workbench.tsx)
- Client portfolio and home routes: [src/app/clients](src/app/clients)
- Client home components: [src/components/client-home](src/components/client-home)
- Review-specific components: [src/components/review](src/components/review)
- Strategy components: [src/components/strategy](src/components/strategy)
- Lock components: [src/components/lock](src/components/lock)
- Drafting components: [src/components/drafting](src/components/drafting)
- Style profile components: [src/components/style-profiles](src/components/style-profiles)
- Ask Setu components: [src/components/chat](src/components/chat)
- Global tokens and shell styling: [src/app/globals.css](src/app/globals.css)
- Snapshot assembly: [src/lib/library.ts](src/lib/library.ts)
- Client registry and migration: [src/lib/clients.ts](src/lib/clients.ts)
- Client activity timeline: [src/lib/timeline.ts](src/lib/timeline.ts)
- Chat orchestration: [src/lib/chat-service.ts](src/lib/chat-service.ts)
- Chat persistence: [src/lib/chat-state.ts](src/lib/chat-state.ts)
- Chat citation enforcement: [src/lib/chat-citation.ts](src/lib/chat-citation.ts)
- Draft persistence and versioning: [src/lib/drafts.ts](src/lib/drafts.ts)
- Draft fact-checking: [src/lib/draft-fact-check.ts](src/lib/draft-fact-check.ts)
- Draft prose-quality checks: [src/lib/draft-prose-check.ts](src/lib/draft-prose-check.ts)
- Synthesis persistence and generation: [src/lib/synthesis.ts](src/lib/synthesis.ts), [src/lib/synthesis-service.ts](src/lib/synthesis-service.ts)
- Packet assembly and export: [src/lib/assembly.ts](src/lib/assembly.ts), [src/lib/audit.ts](src/lib/audit.ts), [src/lib/pdf](src/lib/pdf)
- Lock and unlock logic: [src/lib/lock.ts](src/lib/lock.ts)
- Per-criterion pinboards: [src/lib/pinboards.ts](src/lib/pinboards.ts)
- Style profile persistence: [src/lib/style-profiles.ts](src/lib/style-profiles.ts)
- Ingestion pipeline: [src/lib/ingestion.ts](src/lib/ingestion.ts)
- Summarization and embeddings: [src/lib/ai.ts](src/lib/ai.ts)
- Event bundling: [src/lib/event-bundles.ts](src/lib/event-bundles.ts)
- EB1A classification: [src/lib/eb1a-classification.ts](src/lib/eb1a-classification.ts)
- Criteria tagging: [src/lib/criteria-tagging.ts](src/lib/criteria-tagging.ts)
- Manual overrides: [src/lib/manual-overrides.ts](src/lib/manual-overrides.ts)
- Local vector store integration: [src/lib/qdrant.ts](src/lib/qdrant.ts)

## Persistence model

### Local files

- `storage/uploads`
  - original uploaded evidence by workspace
- `storage/previews`
  - generated preview assets
- `storage/exports`
  - downstream export packages
- `storage/packets`
  - assembled packet previews and filable PDFs
- `storage/qdrant`
  - local Qdrant persistence
- `storage/style-profiles/default.json`
  - curated default drafting exemplars

### Local JSON state

- `storage/state/settings.json`
- `storage/state/jobs.json`
- `storage/state/clients.json`
- `storage/state/clients/<clientId>/client.json`
- `storage/state/clients/<clientId>/timeline.json`
- `storage/state/clients/<clientId>/chat-sessions/*.json`
- `storage/state/clients/<clientId>/strategy-memos/*.json`
- `storage/state/clients/<clientId>/stress-test-reports/*.json`
- `storage/state/clients/<clientId>/pinboards/*.json`
- `storage/state/clients/<clientId>/drafts/*.json`
- `storage/state/clients/<clientId>/synthesis/*.json`
- `storage/state/clients/<clientId>/assembled-packet.json`
- `storage/state/clients/<clientId>/locked-strategy.json`
- `storage/state/style-profiles/*.json`
- `storage/state/event-bundles.json`
- `storage/state/eb1a-classification.json`
- `storage/state/criteria-tagging.json`
- `storage/state/manual-overrides.json`
- `storage/state/review-state.json`

## Local setup

Development run:

```bash
colima start
npm install
npm run dev
```

Local production-style run:

```bash
npm run build
npm start
```

The app runs on [http://localhost:3001](http://localhost:3001).

## Environment

Create `.env.local` if needed:

```bash
OPENAI_API_KEY=...
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1024
QDRANT_URL=http://127.0.0.1:6333
```

Notes:

- `predev` and `prestart` run `scripts/ensure-qdrant.mjs`, so local startup attempts to ensure Qdrant is available.
- the package name is still `eb1a-evidence-studio` for continuity, but the user-facing product brand is `setu`

## Validation

Baseline validation:

```bash
npm run lint
npm run build
```

For Phase 1 UI work, also verify:

- `/` redirects to `/clients` when clients exist
- `/clients` renders the portfolio
- `/clients/<clientId>` renders client home
- `/clients/<clientId>/review` renders action-item review
- `/?view=workspace&clientId=<clientId>` preserves the dense workbench
- pending review actions change counts immediately and persist after reload

For Phase 2 strategy and lock work, also verify:

- `/clients/<clientId>/strategy` renders coverage, memo, stress-test, and Ask Setu
- chat is disabled until every workspace in the client is fully ready
- strategy and stress-test artifacts remain client-scoped
- stress-test produces challenge rows with citations
- `/clients/<clientId>/lock` creates stable exhibit labels
- `/clients/<clientId>/unlock` returns the client to `strategizing`
- client A never retrieves or cites workspace documents from client B

For Phase 3 drafting work, also verify:

- `/clients/<clientId>/drafting` renders the criterion queue
- `/clients/<clientId>/drafting/<criterionCode>` renders the three-column drafting workspace
- generating a draft creates a new version with `source: "ai"`
- Draft mode returns exhibit labels, citations, and fact-check status
- the default style profile loads with 5 curated exemplars
- switching the active style profile changes the exemplar IDs used by Draft generation
- subtle drift surfaces as a warning while significant drift triggers retry or conservative fallback
- generic-prose warnings appear only when the phrase threshold is exceeded

For Phase 4 synthesis and stitching work, also verify:

- `/clients/<clientId>/synthesis` renders both synthesis tabs and approved criterion references
- synthesis generation produces versioned Statement of Eligibility and Final Merits drafts
- synthesis approval advances the client from `synthesizing` to `stitching`
- `/clients/<clientId>/stitching` renders readiness, sections, findings, and exhibit index surfaces
- `GET /api/clients/<clientId>/packet/preview` returns a non-empty PDF
- `POST /api/clients/<clientId>/packet` generates a filable packet when no blocking findings remain
- `GET /api/clients/<clientId>/packet/download` serves the latest assembled PDF
- audit findings surface warnings without blocking generation when appropriate
- Bates ranges are continuous from `PET-000001` through the final exhibit page

## Non-negotiable guardrails

- workspace isolation is mandatory
- original uploads are never modified
- filename rules still win for cleanup routing:
  - `archive` -> `Archive Category`
  - `delete` / `remove` -> `Unwanted`
- if a file has multiple dates, the chosen primary date should be the latest one relevant to the actual subject or event
- human review actions must persist accurately and must remove evidence from pending queues once resolved
- packet assembly must never mutate source drafts or uploaded exhibits
- packet download is not the same thing as filing; filing remains a separate human action
