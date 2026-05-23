# CV Factory

A strategic CV and cover letter generator with feedback loops. Built around a stable **master profile** that gets reweighted per application, not a one-shot generator.

## Phases

1. Master profile + job ad analyzer → strategic brief
2. Cover letter generation with self-critique
2.5. Feedback capture (you talk back to the system)
3. CV variant generation + LaTeX export
4. **Learning layer (pattern detection across saved applications → master profile updates)** ← _you are here_

## What it does (Phases 1–2)

Paste a job ad. The analyzer:

- Extracts requirements (must-haves, nice-to-haves, implicit signals)
- Classifies each against your master profile: **strong**, **partial — reframeable**, **gap**
- Produces a positioning memo: what to lead with, what to reframe, what not to fake

Then click **Generate cover letter** — two LLM passes run in sequence:

1. **Generator** writes a structured draft (opening / bridge paragraphs / optional gap acknowledgement / closing) anchored on the strategic brief and the proof library.
2. **Self-critique** scores the draft on relevance, specificity, honesty, and tone-fit; annotates problem sentences with issue type (unsupported claim, generic platitude, drift, tone mismatch, voice off, or strength); and offers concrete rewrites.

The annotated draft is editable in-place. Click **Apply rewrite** on any annotation to splice the suggestion into the textarea.

## Phase 2.5 — feedback capture

You can talk back to the critique and your edits get stored as a session:

- **Per-annotation**: Accept / Reject / Ignore, with an optional one-line reason.
- **Per-section**: a free-text "your notes" line under each section.
- **Pattern flags**: rules to apply across future applications (e.g., "never claim deep ML expertise", "always anchor on 60+ markets for data roles"). Phase 4 turns these into proposed `learned_preferences` in the master profile.
- **Overall verdict**: "this letter worked" / "this felt off" + optional comment.

Click **Save application** to persist the session to `data/applications/<id>.json`. The directory is git-ignored by default (sessions contain real job ads and your edits). Subsequent saves to the same session overwrite the file.

## Phase 3 — CV variant + LaTeX export

Click **Generate CV variant** (above the cover letter) and the system produces a tailored CV:

- Bullets are reordered or subtly reworded — never invented. The generator validates that every `block_id` exists in the master profile.
- The strategic brief drives `experience_order` (which roles lead) and which skill categories appear first.
- A self-critique pass runs after generation (same axes as the cover letter critique: relevance, specificity, honesty, tone-fit) with annotations targeting `profile_summary` / `experience` / `skills`.

The preview matches the visual style of your Mitigram LaTeX template. **Download .tex** produces a complete document — compile via your existing Overleaf or local pdflatex/tectonic toolchain.

PDF generation deliberately stays out-of-process: the LaTeX is the artifact you already know how to ship.

## Phase 4 — learning layer

Navigate to `/learn` (header link from the homepage) to see the system read across all your saved applications:

- **Aggregate stats**: session count, verdict split, avg critique scores, avg edit fraction per section, annotation accept/reject/ignore counts by issue type.
- **Pattern flags** you added across sessions — counted and deduplicated.
- **Proposed learnings** from two sources:
  - `aggregator` (deterministic): repeated pattern flags, high reject-rate annotation types, heavily edited sections.
  - `llm` (nuanced): voice preferences and cross-section patterns the aggregator can't see. Mocked when `ANTHROPIC_API_KEY` is unset.

Each proposal has Accept / Reject buttons. **Accept** appends a `LearnedPreference` entry (confidence: `confirmed`) to `data/master_profile.json` with the supporting session ids — visible across all future generations because every prompt includes the master profile. **Reject** dismisses locally; the proposal will reappear if the underlying pattern persists.

## Run it

```bash
npm install
cp .env.example .env.local   # optional — add ANTHROPIC_API_KEY for real calls
npm run dev
```

Open <http://localhost:3000>.

Without an API key the analyzer returns a mock response so you can validate the UI flow.

## Project layout

```
app/
  page.tsx                 home page (server component)
  analyzer-client.tsx      paste-and-render UI for the analyzer
  cover-letter-view.tsx    cover letter draft + annotated critique UI
  api/analyze/route.ts     POST: job ad → strategic brief
  api/cover/route.ts       POST: { jobAd, brief } → { letter, critique }
  api/applications/route.ts POST: persist full ApplicationSession (creates or upserts)
  api/cv/route.ts          POST: { brief } → { variant, critique, profile_snapshot }
  api/cv/latex/route.ts    POST: { variant } → text/x-tex attachment
  cv-view.tsx              CV preview + critique + .tex download UI
  api/learn/route.ts       GET: aggregate stats + proposed learnings
  api/learn/apply/route.ts POST: { proposal } → appends LearnedPreference to master_profile.json
  learn/page.tsx           Learning page server entry
  learn/learn-client.tsx   Stats panel + proposals list with Accept/Reject
  globals.css              tailwind entry
  layout.tsx               root layout
data/
  master_profile.json      the single source of truth — edit by hand for now
  applications/            saved sessions (git-ignored)
lib/
  profile-types.ts         zod schemas + types (profile, brief, cover letter, critique, feedback, session)
  load-profile.ts          read+validate master_profile.json
  anthropic.ts             SDK wrapper, mock-fallback helpers
  analyzer.ts              prompt + analyzer entrypoint
  cover-generator.ts       prompt + generator entrypoint (with mock)
  critique.ts              prompt + critique entrypoint (with mock)
  applications.ts          fs-based session persistence
  cv-generator.ts          CV variant generation + block-id validation (with mock)
  cv-critique.ts           CV self-critique pass (with mock)
  latex-template.ts        pure variant → LaTeX renderer (mirrors Mitigram template)
  diff.ts                  token-level Jaccard + change extraction
  learn-aggregator.ts      deterministic stats + threshold-based proposals
  pattern-detector.ts      LLM pattern detection over session digests (with mock)
```

## Editing your master profile

`data/master_profile.json` has `TODO` placeholders. Replace them with the real content from your Mitigram-era CV. Schemas in `lib/profile-types.ts` are enforced by zod on load — if the file is malformed the API will return 500 with a useful message.

## Known gaps (deferred)

- CV variant editing and per-annotation accept/reject (parity with cover letter feedback layer) — extends naturally from the existing `FeedbackBlock` once needed.
- Saving the CV variant into `ApplicationSession` (the schema already has optional `cv_variant` + `cv_critique` slots — UI just needs to include them in the POST payload).
- Bullet-level traceability: today the generator validates only `block_id`s, not individual bullet provenance. Could be tightened to require each variant bullet either matches a master bullet substring or is flagged as a paraphrase.
