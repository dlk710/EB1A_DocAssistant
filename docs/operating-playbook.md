# Setu Operating Playbook

## 1. Purpose

This playbook is the practical guide for operating, validating, and changing Setu safely across the full seven-stage lifecycle:

- Phase 1: client portfolio, home, and review
- Phase 2: strategy, Ask Setu, and lock
- Phase 3: criterion drafting and style profiles
- Phase 4: synthesis, stitching, packet preview, and filable PDF export

Use it when you are:

- running the app locally
- adjusting prompts or models
- changing lifecycle UI
- touching pipeline logic
- validating work before commit or push
- handing the product to another engineer or AI collaborator

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

Treat these as local runtime state, not documentation artifacts.

### Workspace and retrieval state

- `storage/uploads`
- `storage/previews`
- `storage/exports`
- `storage/qdrant`
- `storage/state/jobs.json`
- `storage/state/event-bundles.json`
- `storage/state/eb1a-classification.json`
- `storage/state/criteria-tagging.json`
- `storage/state/manual-overrides.json`
- `storage/state/review-state.json`

### Client lifecycle state

- `storage/state/clients.json`
- `storage/state/clients/<clientId>/client.json`
- `storage/state/clients/<clientId>/timeline.json`
- `storage/state/clients/<clientId>/locked-strategy.json`
- `storage/state/clients/<clientId>/pinboards/*.json`
- `storage/state/clients/<clientId>/drafts/*.json`
- `storage/state/clients/<clientId>/synthesis/*.json`
- `storage/state/clients/<clientId>/assembled-packet.json`
- `storage/state/clients/<clientId>/chat-sessions/*.json`
- `storage/state/clients/<clientId>/strategy-memos/*.json`
- `storage/state/clients/<clientId>/stress-test-reports/*.json`
- `storage/packets/<clientId>/*.pdf`

### Style system state

- `storage/state/style-profiles/*.json`
- `storage/style-profiles/default.json`

## 5. Safe change workflow

For most work:

1. inspect the relevant docs first
2. inspect the affected implementation files
3. make the smallest coherent change
4. run lint and build
5. verify the relevant UI or API path
6. only then commit and push

If a phase-specific flow is already live, preserve it while working forward. Do not break earlier lifecycle stages to land a later one.

## 6. Validation checklist

### Baseline

```bash
npm run lint
npm run build
```

### Phase 1: client lifecycle

Verify:

- `/` redirects to `/clients` when clients exist
- `/clients` renders the portfolio
- `/clients/<clientId>` renders client home
- `/clients/<clientId>/review` renders action-oriented review
- `/?view=workspace&clientId=<clientId>` still opens the dense workbench
- a migrated historical workspace still appears under its client

### Review-action behavior

Verify:

- pending evidence is easy to isolate
- a `Keep`, `Reference`, or `Archive` action immediately removes the item from pending queues
- the count persists correctly after reload
- quick peek still works
- context menus remain inside the viewport
- Reference items render in their own band and do not count toward coverage
- `OTHER` items render in their own placeholder band and do not count toward coverage
- evidence rows expose visible `Assign criterion` and `Actions` controls in addition to right-click
- bundle cards in the human-review queue can be reassigned directly into a criterion
- review cards, table rows, and workbench entries expose permanent `FILE` and `BUNDLE` badges with explicit action wording
- the review page supports `Inbox`, `Table`, `Routing`, `Workbench`, and `By category` without breaking existing actions
- `Routing` shows a folder-first matrix with proposed event, bundle, criterion, decision basis, current placement, and source folder context
- review actions can be staged locally and applied in one pass through `Accept all staged changes`
- the review flow still honors the sequence `file -> bundle -> criterion`

### Pipeline behavior

Verify:

- indexing still completes
- exact duplicates are skipped before AI processing and reported in the intake summary
- `.DS_Store` files are auto-archived before AI processing and reported in the intake summary
- bundling still runs after summarization
- classification still runs after bundling
- tagging still runs after classification
- cancellation stops work at the next safe boundary

### Phase 2: strategy and lock

Verify:

- `/clients/<clientId>/strategy` renders coverage, memo, stress-test, and Ask Setu
- chat readiness blocks clients with unfinished workspaces
- strategy memos persist under the client, not the workspace
- stress-test reports cite only documents from that client
- locking creates stable exhibit labels and per-criterion pinboards
- unlocking clears the active lock file but preserves draft placeholders

### Phase 3: drafting and style profiles

Verify:

- `/clients/<clientId>/drafting` renders the criterion queue
- `/clients/<clientId>/drafting/<criterionCode>` renders the three-column drafting workspace
- generating a draft creates a new version with `source: "ai"`
- manual edits persist to the current in-progress version
- approving a draft sets `latestApprovedVersion` and updates the criterion status chip
- Draft mode returns exhibit labels, citations, and fact-check status
- the default style profile loads with 5 curated exemplars
- changing the active style profile changes the exemplar IDs used by Draft generation
- subtle factual drift surfaces as a warning
- significant drift triggers retry or conservative fallback
- generic-prose warnings appear only when phrase thresholds are exceeded

### Phase 4: synthesis and stitching

Verify:

- `/clients/<clientId>/synthesis` renders both synthesis tabs and approved criterion references
- synthesis generation creates versioned Statement of Eligibility and Final Merits Determination drafts
- approving both synthesis sections advances the client to `stitching`
- `/clients/<clientId>/stitching` renders readiness, sections, findings, and exhibit index
- packet preview returns a non-empty PDF
- filable packet generation succeeds when blocking findings are absent
- packet download serves the current assembled PDF
- Bates numbers are continuous from `PET-000001`
- packet assembly does not mutate source drafts or uploaded exhibits

## 7. Prompt editing rules

Prompt changes should preserve the contract of the corresponding pass:

- summarization remains grounded to the source file
- bundling remains event-focused
- classification remains bundle-focused
- tagging remains evidence-focused
- Ask Setu prompts remain grounded to workspace or client evidence
- Draft mode remains grounded to locked strategy, criterion-scoped evidence, and style exemplars

Do not introduce prompt behavior that collapses multiple passes into one hidden decision.

## 8. UX guardrails

Changes to the interface must preserve these constraints:

- no major blank dead zones on wide screens
- prompt library scrolls inside its own surface
- context menus and submenus do not clip off-screen
- pending human-review items are easy to identify
- reviewed items leave pending queues immediately
- draggable side rails continue to work on desktop where present
- dense operational surfaces remain reachable even after higher-level redesign
- the drafting workspace keeps pinboard, draft pane, and criterion-scoped chat visible without crowding

## 9. Data integrity guardrails

Never break these:

- original evidence files are not modified
- workspace isolation is preserved
- client-to-workspace linkage stays deterministic
- filename routing rules stay deterministic
- manual overrides stay persistent per workspace
- locked exhibit labels remain stable until explicit unlock
- draft versions are append-only
- older workspaces remain readable after new logic lands

## 10. Important files by responsibility

### Client lifecycle

- `src/lib/clients.ts`
- `src/lib/timeline.ts`
- `src/app/clients/page.tsx`
- `src/app/clients/[clientId]/page.tsx`
- `src/app/clients/[clientId]/review/page.tsx`

### Strategy and lock

- `src/lib/chat-service.ts`
- `src/lib/chat-state.ts`
- `src/lib/chat-citation.ts`
- `src/lib/lock.ts`
- `src/lib/pinboards.ts`
- `src/app/clients/[clientId]/strategy/page.tsx`
- `src/app/clients/[clientId]/lock/page.tsx`
- `src/app/clients/[clientId]/unlock/page.tsx`

### Drafting and style profiles

- `src/lib/drafts.ts`
- `src/lib/draft-fact-check.ts`
- `src/lib/draft-prose-check.ts`
- `src/lib/style-profiles.ts`
- `src/app/clients/[clientId]/drafting/page.tsx`
- `src/app/clients/[clientId]/drafting/[criterionCode]/page.tsx`
- `src/app/settings/style-profiles/page.tsx`
- `src/components/drafting/*`
- `src/components/style-profiles/*`

### Synthesis and stitching

- `src/lib/synthesis.ts`
- `src/lib/synthesis-service.ts`
- `src/lib/assembly.ts`
- `src/lib/audit.ts`
- `src/lib/cross-reference.ts`
- `src/lib/bates.ts`
- `src/lib/pdf/*`
- `src/app/clients/[clientId]/synthesis/page.tsx`
- `src/app/clients/[clientId]/stitching/page.tsx`
- `src/components/synthesis/*`
- `src/components/stitching/*`

### UI shell

- `src/components/evidence-workbench.tsx`
- `src/components/client-home/*`
- `src/components/review/*`
- `src/components/chat/*`
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

## 11. Known limitations

- OCR quality still depends on the extractable text path or preview path
- historical workspace migration can create duplicate clients when old jobs clearly belong to the same person but were not linked previously
- style profiles are global and single-active in Phase 3; per-client overrides are later work
- packet generation remains local and manual; Setu does not file with USCIS
- some older internal names still reflect earlier product naming even though the live brand is Setu

## 12. Recommended commit discipline

Keep commits focused on one of these units when possible:

- docs only
- client lifecycle UI
- review action workflow
- strategy and lock
- drafting and style profiles
- pipeline logic
- storage or retrieval changes

That makes later debugging and future AI continuation safer.
