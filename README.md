# setu

Setu is a local-first immigration evidence platform that now starts from the **client record**, not just the upload workspace. The product turns raw folder uploads into a structured review system while preserving original files, intermediate AI reasoning layers, and human override paths.

Phase 1 introduces the client lifecycle shell:

1. manage clients from a portfolio view
2. open a client home with stage status, spend, coverage, and timeline
3. run isolated evidence workspaces under that client
4. review human-action items separately from routine evidence
5. keep the dense workspace tooling available when deeper intervention is needed

## Core objective

Setu exists to make petition evidence preparation faster, more traceable, and more defensible without turning the process into a black box.

The product contract is:

- local-first by default
- AI-first interpretation, human-final judgment
- reversible organization layers
- one client can accumulate multiple workspaces over time
- original evidence is never modified
- every review decision remains inspectable

## Current product scope

The live app at `http://localhost:3001` currently supports:

- client portfolio and client-specific home pages
- folder-based workspace ingestion from the browser
- isolated workspaces per upload, keyed by `jobId`
- OpenAI-powered document summarization
- Qdrant-backed semantic retrieval
- AI event bundling
- AI EB1A bundle classification
- AI document-level criteria tagging
- human review states: `kept`, `pending`, `archived`, `removed`
- manual overrides for evidence, event bundles, and criteria placement
- human-review inbox behavior for pending items
- original-file preview and source access
- prompt editing through Prompt Library
- tracked OpenAI cost by pipeline stage
- local export package generation for downstream drafting

## Phase 1 routes

The current Phase 1 surface is client-first:

- `/clients`
  - portfolio view for all clients
- `/clients/<clientId>`
  - client home with lifecycle summary, blockers, coverage, spend, and timeline
- `/clients/<clientId>/review`
  - action-oriented review page for that client
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

Phase 1 wraps that pipeline in a client model:

1. create or select a client
2. upload a new evidence folder into that client
3. let Setu run the multi-pass AI interpretation flow
4. surface blocking human actions separately from routine evidence
5. review and override in increments across days if needed
6. export downstream outputs once the workspace is mature

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

The client review page is action-oriented. It emphasizes:

- items that still require human judgment
- category bands and archive bands
- human-review queue behavior
- quick actions and quick peek

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
- Technical and system design: [docs/final-design.md](docs/final-design.md)
- Operations and maintenance playbook: [docs/operating-playbook.md](docs/operating-playbook.md)
- Repo-local continuation skill for future AI work: [skills/setu-studio-continuation/SKILL.md](skills/setu-studio-continuation/SKILL.md)

## Repo map

Key implementation files:

- Main UI shell: [src/components/evidence-workbench.tsx](src/components/evidence-workbench.tsx)
- Client portfolio and home routes: [src/app/clients](src/app/clients)
- Client home components: [src/components/client-home](src/components/client-home)
- Review-specific components: [src/components/review](src/components/review)
- Global tokens and shell styling: [src/app/globals.css](src/app/globals.css)
- Snapshot assembly: [src/lib/library.ts](src/lib/library.ts)
- Client registry and migration: [src/lib/clients.ts](src/lib/clients.ts)
- Client activity timeline: [src/lib/timeline.ts](src/lib/timeline.ts)
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
- `storage/qdrant`
  - local Qdrant persistence

### Local JSON state

- `storage/state/settings.json`
- `storage/state/jobs.json`
- `storage/state/clients.json`
- `storage/state/clients/<clientId>/client.json`
- `storage/state/clients/<clientId>/timeline.json`
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

## Non-negotiable guardrails

- workspace isolation is mandatory
- original uploads are never modified
- filename rules still win for cleanup routing:
  - `archive` -> `Archive Category`
  - `delete` / `remove` -> `Unwanted`
- if a file has multiple dates, the chosen primary date should be the latest one relevant to the actual subject or event
- human review actions must persist accurately and must remove evidence from pending queues once resolved
