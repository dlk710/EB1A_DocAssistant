# Setu Phase 2: Strategy And Lock

## Scope

Phase 2 turns Setu from a client-and-review shell into a client-wide strategy system.

It adds three connected capabilities:

1. Ask Setu chat infrastructure
2. the Strategy stage
3. the Lock and Unlock stage

Phase 2 intentionally does **not** ship drafting yet. `Draft` remains visible in Ask Setu, but disabled until Phase 3.

## What changed

### Client-wide retrieval

Phase 1 preserved strict isolation between clients and workspaces. Phase 2 keeps that guarantee, but allows a client to retrieve across all of its own ready workspaces.

That means:

- workspace A and workspace B can both inform the same client strategy memo
- client A can never retrieve documents from client B
- chat readiness is blocked until every workspace in that client is strategy-ready

### Ask Setu

Ask Setu is now a real client-scoped reasoning layer instead of a placeholder launcher.

Implemented modes:

- `Triage`
  - answers evidence questions with citations
- `Strategy`
  - produces a structured strategy memo
- `Stress-test`
  - surfaces USCIS-style risks against the current theory

Deferred mode:

- `Draft`
  - intentionally disabled until Phase 3

Every chat session is stored under:

- `storage/state/clients/<clientId>/chat-sessions/<sessionId>.json`

Pinned artifacts are also client-scoped:

- `strategy-memos/*.json`
- `stress-test-reports/*.json`
- `brief-drafts/*.json` for future work

### Citation contract

The core Phase 2 safety rule is:

> no factual claim survives to the UI unless it resolves to a document that belongs to the active client and can be rendered.

This is enforced in [src/lib/chat-citation.ts](../src/lib/chat-citation.ts).

Behavior by mode:

- Triage drops unsupported answer blocks
- Strategy drops unsupported recommendations, gaps, and risks
- Stress-test drops challenges that do not target real client documents

### Strategy stage

New route:

- `/clients/<clientId>/strategy`

The page combines:

- client-wide coverage card
- criteria grid
- strategy memo card
- inline stress-test card
- Ask Setu side dock

The first strategy memo is auto-generated when none exists. Regeneration is explicit. Stress-test is explicit.

### Lock stage

New routes:

- `/clients/<clientId>/lock`
- `/clients/<clientId>/unlock`

Lock writes a durable `LockedCaseStrategy` and seeds downstream scaffolding:

- stable exhibit numbering
- per-criterion pinboards
- empty criterion draft placeholders
- document-state snapshot at lock time

Persistence:

- `storage/state/clients/<clientId>/locked-strategy.json`
- `storage/state/clients/<clientId>/pinboards/<criterionCode>.json`
- `storage/state/clients/<clientId>/drafts/<criterionCode>.json`

Unlock is reversible but explicit. It preserves draft files and marks them out-of-date rather than deleting them.

## Key files

Primary additions in Phase 2:

- [src/lib/chat-service.ts](../src/lib/chat-service.ts)
- [src/lib/chat-state.ts](../src/lib/chat-state.ts)
- [src/lib/chat-citation.ts](../src/lib/chat-citation.ts)
- [src/lib/chat-classifier.ts](../src/lib/chat-classifier.ts)
- [src/lib/chat-modes.ts](../src/lib/chat-modes.ts)
- [src/lib/chat-prompts.ts](../src/lib/chat-prompts.ts)
- [src/lib/lock.ts](../src/lib/lock.ts)
- [src/lib/pinboards.ts](../src/lib/pinboards.ts)
- [src/app/clients/[clientId]/strategy/page.tsx](../src/app/clients/%5BclientId%5D/strategy/page.tsx)
- [src/app/clients/[clientId]/lock/page.tsx](../src/app/clients/%5BclientId%5D/lock/page.tsx)
- [src/app/clients/[clientId]/unlock/page.tsx](../src/app/clients/%5BclientId%5D/unlock/page.tsx)

## Validation performed

Phase 2 was validated live against the running local app:

- strategy readiness gate on ready vs. blocked clients
- client home, review, strategy, and lock routes
- strategy memo generation
- stress-test generation
- triage and strategy chat turns
- cross-client workspace isolation
- reversible lock and unlock cycle

## What remains for Phase 3

Phase 3 should build on the locked case theory rather than replacing it.

Expected next layer:

- Draft mode activation in Ask Setu
- per-criterion drafting surface
- draft approval flow
- draft invalidation and revival UX after unlock
