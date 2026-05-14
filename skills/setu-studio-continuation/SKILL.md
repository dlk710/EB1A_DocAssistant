---
name: setu-studio-continuation
description: Use this skill when continuing work on the local-first Setu evidence studio in this repository, especially for UI refinements, documentation updates, review workflow changes, prompt-library work, or pipeline-safe improvements that must preserve the existing multi-pass intelligence and workspace isolation.
---

# Setu Studio Continuation

## Overview

This skill is for safely continuing development on the Setu application in `/Users/lohithdeshpande/Documents/New project 2`. Use it when the task touches the live Setu dashboard, review workflows, prompt library, multi-pass evidence pipeline, documentation, or local persistence.

The priority is continuity without regression. Preserve the current multi-pass flow, local-first runtime, and reviewer override model while improving the product.

## Start Here

Before changing code, read:

1. `/Users/lohithdeshpande/Documents/New project 2/README.md`
2. `/Users/lohithdeshpande/Documents/New project 2/docs/business-product-overview.md`
3. `/Users/lohithdeshpande/Documents/New project 2/docs/final-design.md`
4. `/Users/lohithdeshpande/Documents/New project 2/docs/operating-playbook.md`

Then inspect the core implementation files relevant to the request.

## Non-Negotiables

Always preserve these behaviors:

1. The pipeline remains sequential:
   - indexing
   - bundling
   - classifying
   - tagging
   - ready
2. Every uploaded folder remains an isolated workspace keyed by `jobId`.
3. Original evidence files are never modified.
4. Manual overrides remain persistent and workspace-scoped.
5. Semantic search remains scoped to the active workspace.
6. Prompt Library remains scrollable and usable on real screens.
7. Context menus must stay inside the viewport, including bottom-of-page and right-edge cases.
8. The dashboard and review layouts should use screen real estate well; large dead zones are regressions.
9. The current Setu charcoal-and-amber brand direction must be preserved.

## Key Files

### Product shell and main UI

- `/Users/lohithdeshpande/Documents/New project 2/src/components/evidence-workbench.tsx`
- `/Users/lohithdeshpande/Documents/New project 2/src/app/globals.css`
- `/Users/lohithdeshpande/Documents/New project 2/src/app/layout.tsx`

### Pipeline and retrieval

- `/Users/lohithdeshpande/Documents/New project 2/src/lib/ingestion.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/ai.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/qdrant.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/library.ts`

### Interpretation layers

- `/Users/lohithdeshpande/Documents/New project 2/src/lib/event-bundles.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/eb1a-classification.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/criteria-tagging.ts`

### Review state and overrides

- `/Users/lohithdeshpande/Documents/New project 2/src/lib/manual-overrides.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/review-state.ts`
- `/Users/lohithdeshpande/Documents/New project 2/src/lib/review-routing.ts`

### Documentation

- `/Users/lohithdeshpande/Documents/New project 2/README.md`
- `/Users/lohithdeshpande/Documents/New project 2/docs/business-product-overview.md`
- `/Users/lohithdeshpande/Documents/New project 2/docs/final-design.md`
- `/Users/lohithdeshpande/Documents/New project 2/docs/operating-playbook.md`

## Preferred Workflow

1. Build context from the docs and the relevant files.
2. Make the smallest coherent change that satisfies the request.
3. Use shared tokens from `src/app/globals.css` instead of scattering raw style values.
4. Run:

```bash
npm run lint
npm run build
```

5. For UI work, verify the live app at:
   - `http://localhost:3001/`
   - `http://localhost:3001/review/<jobId>`
6. Confirm the request did not regress:
   - prompt-library scrolling
   - panel resizing
   - ready-state review on the landing page
   - bottom/right context-menu visibility
   - workspace isolation

## When Working On Prompts

Keep the pass boundaries intact:

- summarization should remain document-grounded
- bundling should remain event-focused
- classification should remain bundle-focused
- tagging should remain evidence-focused

Do not hide multiple reasoning layers inside one prompt unless the product direction explicitly changes.

## When Working On UX

Prefer changes that improve reviewer clarity and density without sacrificing calmness. The current UI is expected to:

- feel branded as Setu
- use space intentionally
- make hierarchy obvious
- avoid hidden actions
- support fast review of many evidence files

## Current Product Boundary

The Setu shell, dashboard, review page, prompt library, and multi-pass review flow are live. A full conversational `Ask the studio` dock is not yet a production feature, so do not document or implement it as if it already exists unless the task explicitly adds it.
