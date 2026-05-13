# Design And Product

## Product Intent

This product exists to turn chaotic evidence folders into something a petitioner, attorney, or case prep team can actually use.

The app is optimized for these realities:

- files are dumped into folders without consistent naming
- many files support the same event or project
- some evidence is ambiguous and should not be force-fit
- later petition drafting needs event bundles, exhibit planning, and pruning

## Core Design Choices

## 1. Event-first, not file-first

The most important product choice is that the app organizes around events and projects, not just documents.

Why this matters:

- one event often has many supporting artifacts
- one event may later support more than one legal argument
- users need to visually inspect a bundle, not only a flat classification

## 2. Human-review honesty

The app intentionally keeps `_Unclassified` as a first-class output.

Reason:

- weak evidence should not be forced into a legal bucket
- manual review is part of the real workflow
- trust is better when uncertainty is explicit

## 3. Prompt flexibility in the UX

The prompt library exists because users often refine classification logic during real case prep. Splitting prompt sections by function makes the app editable without turning every prompt change into a code change.

## 4. Guarded prompt experimentation

Prompt flexibility is useful, but prompt drift is dangerous. That is why the product now includes an AI review pass that checks prompt sections together for inconsistencies before a reviewed master prompt is saved.

## 5. Local-first safety

This is built for local use with sensitive evidence. The app favors:

- explicit folder paths
- copy-only behavior
- visible output artifacts
- reviewable JSON/Markdown outputs

## 6. Petition-stage continuity

Most “AI file organizers” stop after sorting files. This product intentionally continues into the next stage by preserving:

- selected vs dropped events
- exhibit bundle titles
- petition notes
- manual reassignment of unclassified evidence

## UX Design Principles

### Make the run understandable

Users should know:

- what the app will touch
- estimated cost
- estimated time
- which criteria are enabled

### Make review visual

The review screen should support fast answers to:

- what evidence landed where
- what events exist inside each criterion
- what still needs human attention
- what will actually be used in the petition

### Support incremental testing

The category scope toggle exists so users can test one criterion at a time before trusting a full-folder run.

### Keep prompt experimentation safe

Prompt edits should be easy, but the app still needs strong output constraints through structured schema and post-classification gates.

### Avoid spending tokens on obvious non-evidence

Administrative filenames marked with `REMOVE` or `DELETE` should not consume classification budget. Those files belong in a visible cleanup path, not the legal-evidence flow.

## Current Product Layers

### Evidence organization layer

- criterion buckets
- event folders
- duplicate detection
- reference file handling

### AI interpretation layer

- structured schema
- configurable prompts
- compact excerpts
- project and category gating
- prompt review and approved master prompt snapshots

### Petition-prep layer

- exhibit list
- audit log
- petition workspace
- final-event selection
- cleanup routing for explicit non-evidence files

## What “Good” Looks Like

A good run should produce:

- a clean organized folder tree
- event bundles that make intuitive sense
- clear separation of weak or off-scope evidence
- enough metadata to start petition drafting without redoing the evidence sort

## Open Future Directions

Likely next improvements:

- direct client form entry in the UI instead of file-based template detection
- stronger event normalization and merge logic
- editable manual event merge/split operations
- richer exhibit sequencing controls
- direct attorney packet export views
- case-local vector memory for event reuse and manual-review retrieval
