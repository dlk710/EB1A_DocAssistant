# Architecture

## High-Level Flow

```text
Input folder
  -> walk + hash
  -> duplicate grouping
  -> text extraction
  -> compact excerpt building
  -> optional project-form detection
  -> LLM classification
  -> scope enforcement
  -> copy + verify
  -> index/audit/workspace generation
  -> review UX
```

## Main Server Surfaces

### HTTP routes

[server.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/server.js) exposes:

- `GET /api/settings`
- `POST /api/settings`
- `POST /api/folder/check`
- `POST /api/runs`
- `GET /api/runs/:id`
- `GET /api/workspace`
- `POST /api/workspace`
- `POST /api/reveal`

### In-memory run model

Runs are kept in memory during a server session. That is fine for the current product because it is a single-user local desktop tool, not a multi-user hosted app.

## Pipeline Design

[lib/pipeline.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/pipeline.js) is the main orchestration layer.

Key responsibilities:

1. folder scan
2. SHA-256 hashing
3. duplicate grouping
4. text preparation
5. project-form registry extraction
6. LLM classification
7. criteria and project scope enforcement
8. copy with post-copy hash verification
9. metadata and audit output generation

## Text Extraction

[lib/extract.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/extract.js) handles:

- PDF extraction via `pdf-parse`
- DOCX extraction via `mammoth`
- plain text and HTML extraction
- aggressive prompt reduction via `buildClassificationExcerpt(...)`

The compact excerpt logic is important because classification quality must stay good while API cost stays low.

## LLM Layer

[lib/llm/index.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/llm/index.js) defines:

- provider registry
- shared JSON schema
- default prompt sections
- prompt assembly
- user prompt templating

[lib/llm/openai.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/llm/openai.js) currently provides:

- single-file structured classification
- batch classification
- token/cost accounting
- quota and auth error normalization

## Event-First Classification Model

The product is intentionally not a simple file-to-folder classifier.

The desired mental model is:

- file -> event
- event -> criterion
- event + evidence files -> petition bundle

That is why the structured output includes fields such as:

- `event_id`
- `event_title`
- `event_date`
- `event_summary`
- `evidence_type`
- `secondary_criterion`

## Project Gating

[lib/project-forms.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/project-forms.js) introduces a pre-pass for:

- `05 — Original Contributions`
- `08 — Leading Critical Role`

Design:

1. detect template/form files
2. extract project names
3. create allowlists by criterion
4. pass those allowlists into prompt context
5. enforce a post-classification gate

This means even if the model tries to classify a file into `05` or `08`, the app can still reject that placement if the evidence does not tie to a client-listed project.

## Category Scope Gating

[lib/criteria.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/criteria.js) supports selective test runs.

This is enforced in two places:

- prompt context tells the model which criteria are allowed
- post-classification logic rejects out-of-scope criteria and sends those files to `_Unclassified`

## Petition Workspace

[lib/petition-workspace.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/petition-workspace.js) persists next-stage curation data in:

- `_petition_workspace.json`
- `_petition_plan.md`

This layer is intentionally separate from raw classification so a reviewer can make downstream decisions without losing the original AI output.

## Frontend Design

[public/app.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/public/app.js) is a vanilla JS stateful client.

Main UI stages:

- start screen
- progress screen
- review screen
- prompt library modal
- settings modal
- event / workspace drawers

The review screen is where classification becomes useful operationally:

- criterion buckets
- letter grouping
- unclassified review
- petition workspace decisions

## Safety Model

Key safety guarantees:

- source folder is read-only
- output cannot be equal to, inside, or above the source folder
- existing output folder is archived before a new run
- every copy is hash-verified

## Tradeoffs

Current tradeoffs are intentional:

- in-memory run state keeps the app simple but is not durable across server restarts
- no database keeps setup local and lightweight
- vanilla JS avoids framework overhead for a desktop-local workflow
- LLM classification is configurable, but quality still depends on prompt quality and source text quality
