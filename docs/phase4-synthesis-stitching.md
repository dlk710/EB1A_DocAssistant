# Setu Phase 4: Synthesis And Stitching

## Summary

Phase 4 completes Setu's MVP lifecycle by adding the last two stages after criterion drafting:

1. `Synthesis`
2. `Stitching`

The result is a seven-stage lifecycle:

1. Onboarding
2. Review
3. Strategy
4. Lock
5. Drafting
6. Synthesis
7. Stitching

Phase 4 does not replace earlier evidence, strategy, or drafting layers. It consumes their approved outputs and assembles a filing-ready packet while preserving traceability.

## Synthesis

The synthesis stage is the analytical bridge between criterion arguments and the final packet.

It introduces two cross-cutting petition sections:

- `Statement of Eligibility`
- `Final Merits Determination`

Each synthesis section:

- is versioned independently
- can be AI-generated, manually edited, and approved
- cites both exhibits and approved criterion drafts
- runs through stricter fact-check and generic-prose checks than ordinary criterion drafting
- can use synthesis-specific style exemplars in the active style profile

The main route is:

- `/clients/<clientId>/synthesis`

The surface mirrors the drafting pattern:

- left rail for approved criterion arguments and strategy framing
- center pane for the active synthesis section
- right chat dock for Ask Setu scoped to that synthesis section

## Stitching

The stitching stage is deterministic rather than AI-heavy.

It assembles:

1. cover sheet
2. table of contents
3. Statement of Eligibility
4. approved criterion arguments in locked order
5. Final Merits Determination
6. exhibit index
7. exhibits in numeric exhibit order

The main route is:

- `/clients/<clientId>/stitching`

The stitching stage performs:

- cross-reference normalization in the assembled output only
- audit finding generation
- Bates pagination
- preview PDF generation
- filable packet generation

## New persistence

Phase 4 adds:

- `storage/state/clients/<clientId>/synthesis/*.json`
- `storage/state/clients/<clientId>/assembled-packet.json`
- `storage/packets/<clientId>/<packetId>.pdf`

These sit on top of existing:

- locked strategy state
- pinboards
- criterion draft versions
- workspace evidence in Qdrant

## API additions

Synthesis routes:

- `GET /api/clients/<clientId>/synthesis`
- `POST /api/clients/<clientId>/synthesis/<kind>`
- `POST /api/clients/<clientId>/synthesis/<kind>/approve`
- `GET /api/clients/<clientId>/synthesis/<kind>/versions/<version>`

Packet routes:

- `GET /api/clients/<clientId>/packet`
- `POST /api/clients/<clientId>/packet`
- `GET /api/clients/<clientId>/packet/preview`
- `GET /api/clients/<clientId>/packet/download`

## Chat impact

Ask Setu remains client-scoped and now supports synthesis drafting through Draft mode when a synthesis section is active.

The synthesis-aware draft path:

- reuses the existing readiness gate
- pulls from approved criterion drafts, locked strategy, and relevant exhibits
- returns `synthesis-draft/1.0` artifacts
- preserves the citation contract

## Audit findings

Phase 4 introduces packet-level findings, including:

- `pinned-exhibit-uncited`
- `cited-exhibit-missing`
- `criterion-reference-out-of-sync`
- `draft-source-out-of-date`
- `exhibit-numbering-gap`
- `bates-pagination-error`
- `unsupported-exhibit-type`

Blocking findings prevent filable packet generation. Warnings do not.

## Validation completed

Phase 4 was validated locally with:

- `npm run lint`
- `npm run build`
- live synthesis generation and approval for both section kinds
- live packet preview PDF generation
- live filable packet generation
- live packet download
- live Ask Setu checks for `Triage`, `Strategy`, and synthesis-scoped `Draft`
- temporary style-profile exemplar CRUD for synthesis kinds
- browser verification for portfolio, synthesis, stitching, and style-profile surfaces

## End-to-end state

After Phase 4, Setu can now move a client from:

- raw folder upload
- through AI interpretation and human review
- into strategy and lock
- into criterion drafting
- into synthesis
- and finally into a Bates-stamped petition packet preview and downloadable PDF

This is the first branch where the full product suite exists in one connected lifecycle.
