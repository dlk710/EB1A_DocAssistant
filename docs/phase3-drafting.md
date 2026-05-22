# Setu Phase 3: Drafting And Style Profiles

## Scope

Phase 3 turns Setu from a locked case-theory system into a controlled drafting workspace.

It adds three connected capabilities:

1. per-criterion drafting surfaces
2. Draft mode in Ask Setu
3. attorney style profiles with curated exemplars

Phase 3A deepens that stage into a recursive argument structure:

- each criterion draft is stored as a `CriterionDraft` tree with nested `SubsectionDraft` nodes
- subsection generation, versioning, and approval replace flat criterion-level editing
- endorsement quotes are extracted verbatim from recommendation-letter documents and bound to sub-claims
- comparable-evidence drafting is a first-class option on the criterion record
- exhibit numbering is chosen at lock time and rendered from a configurable scheme

Phase 3 intentionally does **not** ship full petition stitching, exhibit packet auditing, or PDF export. Those remain later lifecycle work.

## What changed

### Drafting becomes a first-class stage

New routes:

- `/clients/<clientId>/drafting`
- `/clients/<clientId>/drafting/<criterionCode>`

The drafting overview lists every locked criterion and its current state:

- `not-started`
- `in-progress`
- `approved`
- `out-of-date`

Each criterion page uses a three-column layout:

- left: subsection tree and locked strategy notes
- middle: the focused subsection on a paper-like drafting surface
- right: subsection-scoped Ask Setu plus candidate endorsement-quote review

### Draft mode is now active

Phase 2 shipped `Draft` as a deferred mode. Phase 3 turns it on.

Draft mode now retrieves and scopes around the focused subsection:

- locked strategy content for the active criterion
- pinned evidence from the criterion pinboard
- criterion-tagged documents from the client’s ready workspaces
- style exemplars from the active style profile

When a subsection is focused, Setu also carries the subsection title and supporting claim into Draft mode so the prompt stays aligned to the active node.

The output is a versioned brief draft rather than plain prose.

### Draft safety gates

Phase 3 adds two new safety layers on top of the Phase 2 citation contract.

#### Fact-check pass

After draft generation, each paragraph is checked against its cited evidence.

Possible outcomes:

- `verified`
- subtle drift warning
- significant drift, which triggers retry or conservative fallback

This logic lives in [src/lib/draft-fact-check.ts](../src/lib/draft-fact-check.ts) and is wired through [src/lib/chat-service.ts](../src/lib/chat-service.ts) plus [src/lib/chat-citation.ts](../src/lib/chat-citation.ts).

#### Generic-prose warning

Drafts are also scanned for common AI phrasing and repetitive rhetorical patterns.

This does not block the draft. It surfaces a warning so the attorney can edit before approval.

The detector lives in [src/lib/draft-prose-check.ts](../src/lib/draft-prose-check.ts).

### Style profiles

Phase 3 introduces a style system so Draft mode can imitate approved attorney voice instead of defaulting to generic LLM tone.

New routes:

- `/settings/style-profiles`
- `/settings/style-profiles/<id>`

The system includes:

- one curated default profile that ships with Setu
- editable user-created profiles
- per-exemplar criterion labels
- active-profile switching for future draft generations

Persistence:

- `storage/state/style-profiles/*.json`
- `storage/style-profiles/default.json`

### Recursive criterion drafts

Each criterion now has an append-only draft file:

- `storage/state/clients/<clientId>/drafts/<criterionCode>.json`

Each file serializes the whole recursive tree. Within that tree:

- each subsection stores its own paragraph set, endorsement quotes, versions, and approval state
- the criterion stores an aggregate compatibility snapshot so downstream synthesis can continue to consume approved drafting safely
- gap notes surface missing support instead of silently fabricating proof

Each subsection version stores:

- source (`ai`, `manual`, `ai-edited`)
- paragraph list
- endorsement quotes
- exhibit refs
- citations
- fact-check status
- word count
- generation cost where relevant

Approving a subsection sets its `latestApprovedVersion` but does not delete prior versions. A criterion is only fully approved when every required subsection is approved.

### Endorsement quotes

Phase 3A adds a dedicated endorsement-quote workflow:

- candidate passages are extracted from recommendation-letter documents
- accepted quotes are stored as verbatim `EndorsementQuote` objects
- quotes remain anchored to the sub-claim they support
- independence is recorded when it can be inferred safely from employer history
- missing quotes raise a gap note instead of allowing the system to fabricate third-party support

### Exhibit numbering

The lock stage now stores an `ExhibitNumberingScheme` on the locked strategy:

- `flat`
- `letter-grouped`
- `section-grouped`

The default remains `letter-grouped`, with a generated letter map based on the locked criterion order. Attorneys can override the map before locking.

## Key files

Primary additions in Phase 3:

- [src/lib/drafts.ts](../src/lib/drafts.ts)
- [src/lib/subsection-drafts.ts](../src/lib/subsection-drafts.ts)
- [src/lib/criterion-prompts.ts](../src/lib/criterion-prompts.ts)
- [src/lib/endorsement-quotes.ts](../src/lib/endorsement-quotes.ts)
- [src/lib/exhibit-numbering.ts](../src/lib/exhibit-numbering.ts)
- [src/lib/draft-fact-check.ts](../src/lib/draft-fact-check.ts)
- [src/lib/draft-prose-check.ts](../src/lib/draft-prose-check.ts)
- [src/lib/style-profiles.ts](../src/lib/style-profiles.ts)
- [src/app/clients/[clientId]/drafting/page.tsx](../src/app/clients/%5BclientId%5D/drafting/page.tsx)
- [src/app/clients/[clientId]/drafting/[criterionCode]/page.tsx](../src/app/clients/%5BclientId%5D/drafting/%5BcriterionCode%5D/page.tsx)
- [src/app/settings/style-profiles/page.tsx](../src/app/settings/style-profiles/page.tsx)
- [src/app/settings/style-profiles/[id]/page.tsx](../src/app/settings/style-profiles/%5Bid%5D/page.tsx)
- [src/components/drafting/DraftingOverview.tsx](../src/components/drafting/DraftingOverview.tsx)
- [src/components/drafting/DraftingWorkspace.tsx](../src/components/drafting/DraftingWorkspace.tsx)
- [src/components/drafting/SubsectionTree.tsx](../src/components/drafting/SubsectionTree.tsx)
- [src/components/drafting/SubsectionPane.tsx](../src/components/drafting/SubsectionPane.tsx)
- [src/components/drafting/EndorsementQuoteBlock.tsx](../src/components/drafting/EndorsementQuoteBlock.tsx)
- [src/components/drafting/EndorsementQuotePicker.tsx](../src/components/drafting/EndorsementQuotePicker.tsx)
- [src/components/drafting/GapNote.tsx](../src/components/drafting/GapNote.tsx)
- [src/components/drafting/DraftToolbar.tsx](../src/components/drafting/DraftToolbar.tsx)
- [src/components/drafting/VersionCompareModal.tsx](../src/components/drafting/VersionCompareModal.tsx)
- [src/components/drafting/Pinboard.tsx](../src/components/drafting/Pinboard.tsx)
- [src/components/style-profiles/ProfileList.tsx](../src/components/style-profiles/ProfileList.tsx)
- [src/components/style-profiles/ExemplarEditor.tsx](../src/components/style-profiles/ExemplarEditor.tsx)

## Validation performed

Phase 3 was validated locally against the running app and the underlying APIs:

- `npm run lint`
- `npm run build`
- client home, strategy, lock, drafting overview, and drafting workspace routes
- lock relink and downstream drafting visibility
- AI subsection draft generation through the criterion draft route
- Ask Setu `Draft` mode response generation with focused subsection context
- style profile creation, activation, use in Draft mode, reset to default, and cleanup
- fact-check fixture coverage for exact, faithful, subtle, and fabricated drift cases
- generic-prose checks for noisy vs. acceptable prose
- endorsement-quote extraction and verbatim-verification checks
- reversible subsection approval route test
- cross-client isolation for drafting and chat retrieval

## What remains for Phase 4

Phase 4 should build on approved criterion drafts rather than replacing them.

Expected next layer:

- stitching multiple approved criterion drafts into petition sections
- exhibit auditing and packet assembly
- statement of eligibility and final merits composition
- export to attorney-friendly final formats
