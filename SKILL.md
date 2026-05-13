# Repo Skill Guide

This repository is a local EB1A evidence-organization app. If you are modifying it, keep these product assumptions in mind.

## Core Mission

Do not think of this as a generic “document classifier.”

Its core job is to help a user:

- organize evidence into EB1A criteria
- bundle related files by event or project
- keep source files untouched
- preserve metadata needed for later petition drafting

## Primary Concepts

### Event bundle

A real-world event or project that can contain many evidence files.

Examples:

- an award received
- a judging assignment
- a paper publication
- a critical-role project
- an original-contribution project

### Criterion bucket

The legal classification bucket for EB1A.

### Petition workspace

A reviewer-controlled layer that sits after AI classification and helps decide:

- which events stay in the petition
- which events are dropped
- how exhibit bundles should be titled
- how unclassified files should be manually handled

## Non-Negotiable Behaviors

### Source directory safety

The input folder must be treated as read-only.

Never introduce code that:

- writes into the source folder
- moves files out of the source folder
- deletes source files

### Output directory rotation

If output exists, it should be archived with a timestamp and recreated fresh.

### Integrity tracking

Every file should stay accounted for.

If changing copy behavior, preserve:

- SHA-256 hashing
- duplicate tracking
- audit output

### Honest uncertainty

Do not remove or weaken `_Unclassified` as a concept. The app should prefer explicit uncertainty over legal overclaiming.

## AI Design Rules

### Event before criterion

When changing prompts or classification logic, preserve the event-first model.

### Scope gates matter

There are now two major gating systems:

- project gating for criteria `05` and `08`
- category gating for run-scoped testing

Do not rely only on prompt wording. Keep hard post-classification enforcement.

### Prompt configurability is user-facing

Prompt sections are not just internal constants. They are editable in the UI, so changes to prompt structure must stay compatible with the prompt library screen.

### Prompt review is part of the workflow

The app now has an AI review step for prompt sections and a reviewed master prompt snapshot. If you change prompt data structures or save flows, preserve that validation path.

### Cleanup is intentional

Files whose names explicitly contain `REMOVE` or `DELETE` are not normal evidence. They should be routed into `CLEANUP/` and kept out of petition-stage outputs unless a human later decides otherwise.

## Frontend Expectations

The UI should support:

- safe run setup
- understandable cost/time estimates
- visual review of criterion buckets
- visual review of event bundles
- petition-stage curation

When adding features, prefer clarity over cleverness.

## Good Places To Start

- [server.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/server.js)
- [lib/pipeline.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/lib/pipeline.js)
- [public/app.js](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/public/app.js)
- [docs/architecture.md](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/docs/architecture.md)
- [docs/design-and-product.md](/Users/lohithdeshpande/Documents/Claude/Projects/EB1A_DocAssistant/app/docs/design-and-product.md)

## If You Add New Features

Prefer features that strengthen one of these:

- better event bundling
- better petition-stage curation
- lower token cost with stable quality
- safer local behavior
- better review ergonomics

Be cautious with features that:

- hide uncertainty
- overwrite human decisions
- reduce traceability
- weaken auditability
