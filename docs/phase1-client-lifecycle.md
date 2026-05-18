# Setu Phase 1: Client Lifecycle

## Purpose

Phase 1 redesigns Setu from a workspace-first product into a **client-first evidence platform** while preserving the existing multi-pass intelligence stack.

The goal is not to replace the dense evidence workbench. The goal is to wrap it in a clearer operational shell so a legal team can understand:

- which client they are working on
- what stage that client is in
- what still requires human action
- what changed recently

## What changed in Phase 1

### New entry model

Setu now starts from `/clients` when clients exist.

This introduces:

- a portfolio view for all clients
- a client home page
- a client review page
- preserved access to the older dense workspace dashboard

### Client record

Each client now has:

- `client.json`
- a summary entry in `storage/state/clients.json`
- a per-client timeline at `storage/state/clients/<clientId>/timeline.json`

### Workspace ownership

A workspace still remains the processing unit and is still keyed by `jobId`, but now also belongs to a client through `job.clientId`.

## Route model

- `/clients`
  - portfolio of client records
- `/clients/<clientId>`
  - client home with lifecycle status and recent activity
- `/clients/<clientId>/review`
  - action-oriented review surface
- `/?view=workspace&clientId=<clientId>`
  - existing dense intake/dashboard surface
- `/review/<jobId>`
  - existing job-level review surface

## UX intent

Phase 1 is meant to reduce operational confusion.

Before this phase, the reviewer had to infer status from workspace-level screens. After this phase:

- the client home answers “what is happening on this case?”
- the review page answers “what still needs my judgment?”
- the workspace dashboard remains for “I need to work deeply inside this upload”

## Review model

The client review page emphasizes:

- actionable items
- routine items
- category bands
- archive and cleanup bands

The most important behavioral rule is:

> once a reviewer resolves a pending evidence item, it should leave the pending queue immediately and the persisted backend state should reflect the new truth.

## Migration behavior

Historical jobs are lazily migrated into clients.

Current Phase 1 default:

- one historical workspace can become one client if no existing client linkage is present

This is intentionally conservative and may create multiple client records for what is really the same person. That is acceptable in Phase 1 and can be refined later.

## Implementation files

Core files added or heavily used in Phase 1:

- `src/lib/clients.ts`
- `src/lib/timeline.ts`
- `src/app/api/clients/route.ts`
- `src/app/api/clients/[clientId]/route.ts`
- `src/app/api/clients/[clientId]/timeline/route.ts`
- `src/app/clients/page.tsx`
- `src/app/clients/[clientId]/page.tsx`
- `src/app/clients/[clientId]/review/page.tsx`
- `src/components/client-home/*`
- `src/components/review/*`

## Validation expectations

At minimum, Phase 1 changes should verify:

- `/` redirects to `/clients`
- `/clients` renders the portfolio
- client home renders stage, blocker, coverage, spend, and timeline
- client review renders action-oriented review
- dense workspace surface remains reachable
- pending review actions update counts immediately and persist after reload

## What Phase 1 does not change

Phase 1 does **not** replace:

- Qdrant as the evidence retrieval store
- the existing indexing -> bundling -> classifying -> tagging pipeline
- the ability to review at the workspace level
- the original-file preview and export model

Those remain the core substrate under the new lifecycle shell.
