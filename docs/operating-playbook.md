# Setu Operating Playbook

## 1. Purpose

This playbook is the practical operating guide for running, validating, and changing Setu safely.

Use it when you are:

- running the app locally
- modifying prompts
- adjusting UI behavior
- changing pipeline logic
- validating work before commit or push

## 2. Local runtime

Development:

```bash
colima start
npm install
npm run dev
```

Production-style local run:

```bash
npm run build
npm start
```

The application runs on [http://localhost:3001](http://localhost:3001).

## 3. Environment settings

Typical `.env.local` values:

```bash
OPENAI_API_KEY=...
OPENAI_SUMMARY_MODEL=gpt-4.1-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_EMBEDDING_DIMENSIONS=1024
QDRANT_URL=http://127.0.0.1:6333
```

Settings can also be managed through the product UI and stored in `storage/state/settings.json`.

## 4. Core persistence paths

- `storage/uploads`
- `storage/previews`
- `storage/exports`
- `storage/qdrant`
- `storage/state/*.json`

Treat these as local runtime state, not documentation artifacts.

## 5. Safe change workflow

For most work:

1. inspect the relevant docs first
2. inspect the affected implementation files
3. make the smallest coherent change
4. run lint and build
5. verify the relevant UI or API path
6. only then commit and push

## 6. Validation checklist

### Baseline

```bash
npm run lint
npm run build
```

### Dashboard work

Verify:

- page renders on `/`
- ready-state review still appears when the workspace is complete
- recent workspace history still shows correctly
- panel resizing still works on desktop
- prompt library remains scrollable

### Review work

Verify:

- page renders on `/review/<jobId>`
- semantic search remains workspace-scoped
- filter controls work
- drag/drop overrides still behave correctly
- right-click menus stay inside the viewport
- quick peek remains usable near the bottom of the page

### Pipeline work

Verify:

- indexing still completes
- bundling still runs after summarization
- classification still runs after bundling
- tagging still runs after classification
- cancellation stops work at the next safe boundary

## 7. Prompt editing rules

Prompt changes should preserve the contract of the corresponding pass:

- summarization remains grounded to the source file
- bundling remains event-focused
- classification remains bundle-focused
- tagging remains evidence-focused

Do not introduce prompt behavior that collapses multiple passes into one hidden decision.

## 8. UX guardrails

Changes to the interface must preserve these user-tested constraints:

- no major blank dead zones on wide screens
- prompt library scrolls inside its own surface
- context menus and submenus do not clip off-screen
- review controls remain visible and legible near page bottom
- draggable side rails continue to work on desktop
- review hierarchy remains understandable at a glance

## 9. Data integrity guardrails

Never break these:

- original evidence files are not modified
- workspace isolation is preserved
- filename routing rules stay deterministic
- manual overrides stay persistent per workspace
- older workspaces remain readable after new logic lands

## 10. Important files by responsibility

### UI

- `src/components/evidence-workbench.tsx`
- `src/app/globals.css`
- `src/app/layout.tsx`

### Pipeline and storage

- `src/lib/ingestion.ts`
- `src/lib/ai.ts`
- `src/lib/qdrant.ts`
- `src/lib/library.ts`

### Interpretation layers

- `src/lib/event-bundles.ts`
- `src/lib/eb1a-classification.ts`
- `src/lib/criteria-tagging.ts`

### Review state and overrides

- `src/lib/manual-overrides.ts`
- `src/lib/review-state.ts`
- `src/lib/review-routing.ts`

## 11. Known limitations

- OCR quality depends on the extractable text path or preview path
- full grounded conversational review is not yet implemented as a first-class feature
- some internal names still reflect earlier product naming even though the user-facing brand is Setu

## 12. Recommended commit discipline

Keep commits focused on one of these units when possible:

- docs only
- UX refinement
- pipeline logic
- storage or retrieval changes
- review override behavior

That makes later debugging and future AI continuation much safer.
