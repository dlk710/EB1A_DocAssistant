# EB1A Evidence Studio

Local-first Next.js application for turning raw evidence folders into a reviewable EB1A workspace without losing the original documents or the intermediate AI reasoning.

The current product keeps the original multi-pass intelligence intact:

1. Document indexing and summarization
2. Event bundling
3. Bundle-level EB1A classification
4. Document-level evidence tagging for review

The v3 rebuild adds a denser review UX, document-level keep/archive triage, evidence criteria tagging, sub-bundles, bulk review actions, coverage tracking, and a dashboard/review split that still runs on the same Qdrant + JSON-state backend.

## Documentation

- Design document: [docs/final-design.md](docs/final-design.md)

## Core capabilities

- Upload a folder from the browser, including nested directories.
- Treat every upload as an isolated workspace keyed by `jobId`.
- Save originals under `storage/uploads/<jobId>/`.
- Store searchable document vectors and payloads in local Qdrant.
- Summarize each file with OpenAI and extract review metadata, tags, entities, dates, and preview context.
- Group related files into AI-generated event bundles.
- Classify event bundles into EB1A criteria plus review buckets such as `Archive Category`, `Unwanted`, and `Human Review`.
- Run a final AI tagging pass on individual evidence files to assign review-ready criterion hints plus `kept` / `pending` / `archived` defaults.
- Show review in two layouts:
  - `By bundle`
  - `By criterion`
- Support manual overrides at any time:
  - move files between bundles
  - move bundles between EB1A categories
  - change evidence criteria
  - keep / archive / remove evidence
  - create sub-bundles for drill-down organization
- Open original document previews from the review workspace with `Quick peek`.
- Track OpenAI cost across summarization, bundling, classification, and tagging.
- Export a classified output package with references for downstream petition drafting.

## Current review pipeline

The live V3 pipeline is:

1. `Indexing`
2. `Bundling`
3. `Classifying`
4. `Tagging`
5. `Ready`

Behavior:

- The dashboard shows progress immediately after `Index folder`.
- The dedicated review page is available for deeper search while later passes are still running.
- The main landing page only restores the full review surface once the workspace truly reaches `Ready`.
- Cancellation is cooperative and stops at the next safe AI boundary.

## Review UX highlights

- Candidate identity stays visible throughout the workspace.
- Historical workspaces live in a compact dropdown.
- Semantic search is scoped to the selected workspace only.
- A normal keyword filter is available alongside semantic retrieval.
- Evidence rows support multi-select, bulk actions, right-click context actions, and drag/drop overrides.
- Criteria chips preserve AI confidence plus manual override state.
- Coverage remains visible so the reviewer can see which EB1A criteria are currently strong, partial, or empty.

## Prompt library

The Prompt Library now manages three editable active prompts:

- Document summary prompt
- Bundle classification prompt
- Evidence tagging prompt

Only the current active prompt text is saved. Prompt history is intentionally not stored.

## Storage layout

- `storage/uploads`
  - uploaded originals per workspace
- `storage/previews`
  - generated preview assets
- `storage/qdrant`
  - local Qdrant persistence
- `storage/exports`
  - review-ready output packages
- `storage/state/settings.json`
  - runtime settings and active prompts
- `storage/state/jobs.json`
  - indexing jobs and progress
- `storage/state/event-bundles.json`
  - per-workspace event bundling state
- `storage/state/eb1a-classification.json`
  - per-workspace EB1A classification state
- `storage/state/criteria-tagging.json`
  - per-workspace document tagging state
- `storage/state/manual-overrides.json`
  - category and event override state
- `storage/state/review-state.json`
  - sub-bundles and review-only UI state

## Local setup

```bash
colima start
npm install
npm run dev
```

The app runs locally at [http://localhost:3001](http://localhost:3001).

Production-style local run:

```bash
npm run build
npm start
```

`npm start` and `npm run dev` both ensure local Qdrant is available first.

## Environment

Create `.env.local` if needed:

```bash
OPENAI_API_KEY=...
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1024
QDRANT_URL=http://127.0.0.1:6333
```

## API surface

Key routes:

- `POST /api/ingest`
- `GET /api/library`
- `GET /api/search`
- `GET /api/coverage`
- `POST /api/tag/start`
- `POST /api/tag/retry`
- `GET /api/tag/status`
- `PATCH /api/evidence/:id/status`
- `POST /api/evidence/bulk-status`
- `POST /api/evidence/:id/criteria`
- `PATCH /api/evidence/:id/criteria/:code`
- `DELETE /api/evidence/:id/criteria/:code`
- `POST /api/evidence/:id/move`
- `POST /api/evidence/bulk-move`
- `POST /api/bundles/:id/sub-bundles`
- `PATCH /api/sub-bundles/:id`
- `DELETE /api/sub-bundles/:id`

## Notes

- Filename rules still win over AI for cleanup cases:
  - `archive` -> `Archive Category`
  - `delete` / `remove` -> `Unwanted`
- If a file contains multiple dates, the summarizer uses the latest date relevant to the actual subject or event, not a scan timestamp.
- Original source files are never modified.
- Hidden system files such as `.DS_Store` are filtered out of normal evidence review.
- Older workspaces automatically re-run newer downstream passes when the review-state version or prompt fingerprint changes.
