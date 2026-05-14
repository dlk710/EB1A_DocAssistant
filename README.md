# EB1A Evidence Studio

Local-first Next.js workspace for organizing candidate evidence folders, generating AI summaries per file, grouping related evidence into event bundles, classifying those bundles into EB1A categories, previewing originals, and storing the searchable review library in local Qdrant.

## Documentation

- Final design document: [docs/final-design.md](docs/final-design.md)

## What it does

- Accepts a folder upload from the browser, including nested files.
- Treats every uploaded folder as an isolated workspace keyed by `jobId`.
- Saves the uploaded files locally under `storage/uploads/<job-id>/`.
- Stores each document in local Qdrant with metadata, summary payload, and embeddings.
- Parses common evidence formats including `pdf`, `docx`, `txt`, `md`, `csv`, `json`, `eml`, common images, and Quick Look-supported office files such as `pptx`.
- Uses OpenAI to generate grounded per-file summaries, tags, metadata, and the latest subject-relevant date for each file.
- Runs a second AI pass that bundles related evidence into real-world events such as projects, speaking engagements, judging roles, authorship efforts, and employment records, then renames those bundles into short year-month labels.
- Applies deterministic filename routing before final review:
  - files with `archive` in the filename are routed to `Archive Category`
  - files with `delete` or `remove` in the filename are routed to `Unwanted`
- Runs a third AI pass that classifies completed event bundles into EB1A categories or routes them to human review when the evidence is too ambiguous.
- Writes a local output package for each completed classified workspace, including organized criterion folders, copied evidence, references, an index, and a human-review queue.
- Tracks OpenAI usage and estimated USD cost per document, per bundle pass, and per workspace.
- Separates the UI into:
  - a dashboard for intake, candidate settings, workspace selection, and ready-state review
  - a dedicated review page opened from `Folder Workspaces` for deeper search, drilldown, and overrides
- Lets you review the workspace in two levels:
  - document-level review while bundling is queued or processing
  - event-level review once bundling is complete
- Enriches the event review with a final drilldown layout of `criteria -> event bundles -> files`, plus explicit archive, unwanted, and human-review states once classification completes.
- Brings the review tree back onto the main landing page automatically once the pipeline reaches `Ready to review`, while keeping semantic search on the dedicated review page.
- Uses consistent color coding plus a small legend so criteria buckets, event bundles, evidence files, archive, unwanted, and human-review states are visually distinct throughout review.
- Keeps the main review surface wide by opening previews on demand from each evidence row instead of reserving a permanent preview rail.
- Lets a reviewer mark each evidence row as `Keep`, `Archive`, or `Remove` before petition drafting, with preview, override, and classification state preserved per workspace.
- Adds a `Cancel` control beside `Index Folder` so a user can clear a selected folder before indexing or request cancellation of an active indexing/bundling/classification run at the next safe step.
- Supports a configurable Prompt Library in the UI for both document summarization and EB1A classification. Only the active prompts are saved; prompt history is not stored.

## Current scope

- The product is currently focused on evidence intake, summarization, event grouping, EB1A bundle classification, review, export packaging, and retrieval.
- EB1A categorization now happens at the event-bundle layer, not at the single-document layer.
- `possibleCriteria` is still forced to an empty array in document summaries; criterion assignment is handled only after event bundling.

## Local setup

```bash
colima start
npm install
npm run dev
```

The app runs on `http://localhost:3001`.

`npm run dev` and `npm start` automatically ensure the local Qdrant container is running at `http://127.0.0.1:6333`.

## Environment

Copy `.env.example` to `.env.local` and add your key if needed.

```bash
OPENAI_API_KEY=...
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1024
QDRANT_URL=http://127.0.0.1:6333
```

## Storage layout

- Qdrant vectors and payloads: `storage/qdrant`
- Uploaded source files: `storage/uploads`
- Generated preview assets: `storage/previews`
- Exported classified workspaces: `storage/exports`
- Local app state:
  - `storage/state/settings.json`
  - `storage/state/jobs.json`
  - `storage/state/event-bundles.json`
  - `storage/state/eb1a-classification.json`

## Notes

- The UI masks the API key and keeps it server-side.
- If a file contains multiple dates, the summarizer chooses the latest date tied to the document’s actual subject or event.
- Hidden system files such as `.DS_Store` are filtered from review and event bundling.
- Uncertain or weakly supported event bundles are intentionally routed to human review instead of being force-fit into an EB1A category.
- Filename rules override AI grouping for cleanup cases, so `archive`, `delete`, and `remove` never silently blend into normal EB1A buckets.
- Original source files are never modified.
