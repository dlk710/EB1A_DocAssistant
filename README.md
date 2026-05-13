# EB1A DocAssistant

Local web app for organizing EB1A evidence into reusable event bundles, criterion buckets, and petition-planning outputs.

## Core Objective

The product is designed for a messy real-world input folder where many unrelated files are dumped together. Instead of only classifying each file independently, the app tries to:

- identify the real-world event or project the file belongs to
- map that event to an EB1A criterion
- bundle related evidence together under the same event folder
- preserve enough metadata to build a petition later

This makes the output useful for both:

- first-pass evidence organization
- later petition drafting, exhibit planning, and pruning

## What The App Does

For each run, the app:

1. scans every file in the source directory
2. hashes files for integrity and duplicate detection
3. extracts text from readable files
4. builds compact AI excerpts to reduce token cost
5. classifies files into EB1A criteria and reusable event bundles
6. copies files into a new organized output directory
7. writes audit, index, and petition-workspace metadata

Important safety rules:

- the source directory is read-only
- output cannot be written inside the source directory
- if the target directory already exists, it is renamed with a timestamp and a fresh output directory is created

## Main Product Behaviors

### Event-first organization

The app treats the event as the reusable evidence unit. Multiple files such as:

- invitation
- thank-you email
- certificate
- recommendation letter
- screenshot
- media article

can all land in the same event bundle.

### Petition workspace

Each run now creates planning artifacts for the next stage:

- `_petition_workspace.json`
- `_petition_plan.md`

These store:

- which events are selected for the petition
- which events are dropped for now
- exhibit bundle titles
- petition notes
- manual review decisions for unclassified files

### Prompt-driven classification

The app uses structured LLM classification with a configurable prompt library in the UI. Prompt sections are split by function so users can edit behavior without editing source code.

### Project-scoped classification

For `05 — Original Contributions` and `08 — Leading Critical Role`, the app can detect client-filled template forms, extract project names, and restrict those criteria to evidence tied to the listed projects only.

### Category-scoped test runs

Users can limit a run to only selected EB1A categories. This is especially useful for testing one bucket at a time, such as only `04 — Judging`.

## Run Locally

```bash
npm install
npm run mock
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Key Configuration

Runtime settings are stored in `config/settings.local.json` and can also be edited through the UI.

Notable settings:

- provider and model
- API key
- spending cap
- processing mode: `standard`, `auto`, `batch`
- batch threshold
- selected criteria for scoped runs
- prompt sections

`config/settings.local.json` is gitignored.

## Output Structure

Typical output:

```text
output/
├── 01 — Awards & Recognition/
├── 02 — Memberships/
├── 03 — Published Material/
├── 04 — Judging/
├── 05 — Original Contributions/
├── 06 — Authorship/
├── 07 — Exhibitions/
├── 08 — Leading Critical Role/
├── 09 — High Salary/
├── 10 — Commercial Success/
├── 11 — Comparable Evidence/
├── _Unclassified/
├── _Duplicates/
├── _Reference/
├── _audit.csv
├── _exhibit_list.md
├── _index.json
├── _index.md
├── _petition_plan.md
└── _petition_workspace.json
```

## Repo Map

- [server.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/server.js): Express server and API routes
- [lib/pipeline.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/pipeline.js): main end-to-end organization pipeline
- [lib/extract.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/extract.js): text extraction and compact excerpt logic
- [lib/project-forms.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/project-forms.js): project-template detection and project gating
- [lib/criteria.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/criteria.js): criterion lists and scoped-run gating
- [lib/petition-workspace.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/petition-workspace.js): petition-stage metadata persistence
- [lib/index-md.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/index-md.js): `_index.md`, `_index.json`, `_exhibit_list.md`
- [public/index.html](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/public/index.html): app shell
- [public/app.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/public/app.js): frontend behavior
- [public/styles.css](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/public/styles.css): UI styling

## Design Docs

- [docs/architecture.md](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/docs/architecture.md)
- [docs/design-and-product.md](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/docs/design-and-product.md)
- [SKILL.md](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/SKILL.md)
