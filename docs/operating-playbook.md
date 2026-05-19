# Setu Operating Playbook

## 1. Purpose

This playbook is the practical operating guide for running, validating, and changing Setu safely.

Use it when you are:

- running the app locally
- modifying prompts
- adjusting UI behavior
- changing pipeline logic
- validating work before commit or push
- continuing the Phase 1 and Phase 2 client lifecycle work

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
- `storage/state/jobs.json`
- `storage/state/clients.json`
- `storage/state/clients/<clientId>/client.json`
- `storage/state/clients/<clientId>/timeline.json`
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

### Client lifecycle work

Verify:

- `/` redirects to `/clients` when clients exist
- `/clients` renders the portfolio
- `/clients/<clientId>` renders client home
- `/clients/<clientId>/review` renders action-oriented review
- `/clients/<clientId>/strategy` renders coverage, memo, stress-test, and Ask Setu
- `/clients/<clientId>/lock` renders lock staging
- `/clients/<clientId>/unlock` preserves drafts while returning the client to strategy
- `/?view=workspace&clientId=<clientId>` still opens the dense workbench
- a migrated historical workspace still appears under its client

### Review action work

Verify:

- pending evidence is easy to isolate
- a `Keep`, `Archive`, or `Remove` action immediately removes the item from pending queues
- the count persists correctly after reload
- quick peek still works
- context menus remain inside the viewport

### Pipeline work

Verify:

- indexing still completes
- bundling still runs after summarization
- classification still runs after bundling
- tagging still runs after classification
- cancellation stops work at the next safe boundary

### Strategy and lock work

Verify:

- chat readiness blocks clients with unfinished workspaces
- strategy memos persist under the client, not the workspace
- stress-test reports cite only documents from that client
- locking creates stable exhibit labels and per-criterion pinboards
- unlocking clears the active lock file but preserves draft placeholders

## 7. Prompt editing rules

Prompt changes should preserve the contract of the corresponding pass:

- summarization remains grounded to the source file
- bundling remains event-focused
- classification remains bundle-focused
- tagging remains evidence-focused
- Ask Setu prompts remain grounded to workspace evidence

Do not introduce prompt behavior that collapses multiple passes into one hidden decision.

## 8. UX guardrails

Changes to the interface must preserve these user-tested constraints:

- no major blank dead zones on wide screens
- prompt library scrolls inside its own surface
- context menus and submenus do not clip off-screen
- pending human-review items are easy to identify
- reviewed items leave pending queues immediately
- draggable side rails continue to work on desktop where present
- dense operational surfaces remain reachable even after higher-level redesign

## 9. Data integrity guardrails

Never break these:

- original evidence files are not modified
- workspace isolation is preserved
- client-to-workspace linkage stays deterministic
- filename routing rules stay deterministic
- manual overrides stay persistent per workspace
- older workspaces remain readable after new logic lands

## 10. Important files by responsibility

### Client lifecycle

- `src/lib/clients.ts`
- `src/lib/timeline.ts`
- `src/app/clients/page.tsx`
- `src/app/clients/[clientId]/page.tsx`
- `src/app/clients/[clientId]/review/page.tsx`

### UI shell

- `src/components/evidence-workbench.tsx`
- `src/components/client-home/*`
- `src/components/review/*`
- `src/app/globals.css`

### Pipeline and storage

- `src/lib/ingestion.ts`
- `src/lib/ai.ts`
- `src/lib/qdrant.ts`
- `src/lib/library.ts`
- `src/lib/state-store.ts`

### Interpretation layers

- `src/lib/event-bundles.ts`
- `src/lib/eb1a-classification.ts`
- `src/lib/criteria-tagging.ts`

### Review state and overrides

- `src/lib/manual-overrides.ts`
- `src/lib/review-state.ts`
- `src/app/api/evidence/[id]/status/route.ts`
- `src/app/api/evidence/bulk-status/route.ts`
- `src/app/api/overrides/route.ts`

## 11. Known limitations

- OCR quality still depends on the extractable text path or preview path
- historical workspace migration can create duplicate clients when old jobs clearly belong to the same person but were not linked previously
- some older internal names still reflect earlier product naming even though the live brand is Setu

## 12. Recommended commit discipline

Keep commits focused on one of these units when possible:

- docs only
- client lifecycle UI
- review action workflow
- pipeline logic
- storage or retrieval changes

That makes later debugging and future AI continuation safer.
