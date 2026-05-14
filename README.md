# setu

Setu is a local-first evidence studio for immigration petition preparation. It turns raw folder uploads into a structured review workspace while preserving the original files, the intermediate AI reasoning layers, and the human override path.

The current implementation is built for a practical review flow:

1. upload a folder of evidence
2. summarize each document
3. bundle related files into real-world events
4. classify those bundles into EB1A criteria and review buckets
5. tag individual evidence files for human review
6. let a reviewer override anything before downstream drafting

## Core objective

Setu exists to make evidence preparation faster, more traceable, and more defensible without turning the process into a black box.

The product objective is:

- keep the workflow local-first
- preserve every original file
- let AI do the first interpretation pass
- let a human make the final judgment
- keep every review layer reversible and inspectable

## Current product scope

The live application at `http://localhost:3001` currently supports:

- folder-based workspace ingestion from the browser
- isolated workspaces per upload, keyed by `jobId`
- OpenAI-powered document summarization
- Qdrant-backed semantic retrieval
- AI event bundling
- AI EB1A bundle classification
- AI document-level criteria tagging
- `kept` / `pending` / `archived` review state
- manual overrides for evidence, event bundles, and criteria placement
- sub-bundles for reviewer organization
- original-file preview and source access
- prompt editing through Prompt Library
- tracked OpenAI cost by pipeline stage
- local export package generation for downstream drafting

## Product workflow

The implemented multi-pass pipeline is:

1. `Indexing`
2. `Bundling`
3. `Classifying`
4. `Tagging`
5. `Ready`

Design rules for the pipeline:

- each pass is independently rerunnable
- downstream passes do not destroy upstream outputs
- historical workspaces can be reinterpreted by newer downstream logic
- cancellation is cooperative and stops at the next safe boundary
- workspace isolation is preserved throughout search, preview, review, and export

## Main surfaces

### Dashboard

The dashboard is the intake and oversight surface. It includes:

- Setu-branded top shell
- candidate identity
- folder workspace picker with recent run history
- pipeline visibility and stage status
- cost and coverage summaries
- draggable side rails on desktop
- ready-state review surface once the workspace is actually reviewable

### Dedicated review page

The review page at `/review/<jobId>` is the focused retrieval and override surface. It supports:

- semantic search scoped to the active workspace
- keyword filtering
- criterion-first and bundle-first review
- drag/drop overrides
- right-click actions
- evidence quick peek

### Prompt Library

Prompt Library is a large scrollable modal used to edit the active prompts for:

- document summarization
- bundle classification
- criteria tagging

Only the active prompt text is stored. Prompt history is intentionally not stored.

## Setu brand direction

Setu now uses the v4 charcoal-and-amber identity:

- dominant brand color: charcoal `#1A1A1F`
- primary accent: amber `#BA7517`
- supporting paper tones: warm neutrals for workspace readability

Implementation rules:

- use app-wide tokens from [src/app/globals.css](src/app/globals.css)
- do not add raw hex values in component code unless a token is introduced first
- use amber sparingly for emphasis rather than large washes
- preserve the `setu` wordmark and deck treatment in the application chrome

## Documentation map

- Business and product overview: [docs/business-product-overview.md](docs/business-product-overview.md)
- Technical and system design: [docs/final-design.md](docs/final-design.md)
- Operations and maintenance playbook: [docs/operating-playbook.md](docs/operating-playbook.md)
- Repo-local continuation skill for future AI work: [skills/setu-studio-continuation/SKILL.md](skills/setu-studio-continuation/SKILL.md)

## Repo map

Key implementation files:

- Main UI: [src/components/evidence-workbench.tsx](src/components/evidence-workbench.tsx)
- Global tokens and shell styling: [src/app/globals.css](src/app/globals.css)
- Root metadata: [src/app/layout.tsx](src/app/layout.tsx)
- Snapshot assembly: [src/lib/library.ts](src/lib/library.ts)
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

- `predev` and `prestart` run `scripts/ensure-qdrant.mjs`, so local startup will attempt to ensure Qdrant is available.
- the package name is still `eb1a-evidence-studio` for continuity, but the user-facing product brand is now `setu`.

## Validation

Baseline validation for most changes:

```bash
npm run lint
npm run build
```

For UI work, also verify:

- dashboard on `http://localhost:3001`
- review page on `http://localhost:3001/review/<jobId>`
- prompt library scrolling
- desktop panel resizing
- viewport-safe context menus
- ready-state review rendering

## Non-negotiable guardrails

- workspace isolation is mandatory
- original uploads are never modified
- filename rules still win for cleanup routing:
  - `archive` -> `Archive Category`
  - `delete` / `remove` -> `Unwanted`
- if a file has multiple dates, the chosen primary date should be the latest one relevant to the actual subject or event
- semantic search must stay scoped to the active workspace
- prompt library must remain scrollable
- context menus must stay inside the viewport
- dashboard and review rails remain draggable on desktop
- real estate should be used intentionally; large dead areas should be treated as regressions

## Current boundaries

- OCR quality still depends on extractable text or preview-layer availability
- the current Setu shell is live, but the full `Ask the studio` dock from the wireframe is not yet a production feature
- some internal file names and package identifiers still carry earlier product naming, but this branch documents the current Setu product state
