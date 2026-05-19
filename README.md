# CV Factory

A strategic CV and cover letter generator with feedback loops. Built around a stable **master profile** that gets reweighted per application, not a one-shot generator.

## Phases

1. Master profile + job ad analyzer → strategic brief
2. **Cover letter generation with self-critique** ← _you are here_
3. CV variant generation + PDF export
4. Feedback loop with learned preferences

## What it does (Phases 1–2)

Paste a job ad. The analyzer:

- Extracts requirements (must-haves, nice-to-haves, implicit signals)
- Classifies each against your master profile: **strong**, **partial — reframeable**, **gap**
- Produces a positioning memo: what to lead with, what to reframe, what not to fake

Then click **Generate cover letter** — two LLM passes run in sequence:

1. **Generator** writes a structured draft (opening / bridge paragraphs / optional gap acknowledgement / closing) anchored on the strategic brief and the proof library.
2. **Self-critique** scores the draft on relevance, specificity, honesty, and tone-fit; annotates problem sentences with issue type (unsupported claim, generic platitude, drift, tone mismatch, voice off, or strength); and offers concrete rewrites.

The annotated draft is editable in-place. Click **Apply rewrite** on any annotation to splice the suggestion into the textarea.

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
  globals.css              tailwind entry
  layout.tsx               root layout
data/
  master_profile.json      the single source of truth — edit by hand for now
lib/
  profile-types.ts         zod schemas + types (profile, brief, cover letter, critique)
  load-profile.ts          read+validate master_profile.json
  anthropic.ts             SDK wrapper, mock-fallback helpers
  analyzer.ts              prompt + analyzer entrypoint
  cover-generator.ts       prompt + generator entrypoint (with mock)
  critique.ts              prompt + critique entrypoint (with mock)
```

## Editing your master profile

`data/master_profile.json` has `TODO` placeholders. Replace them with the real content from your Mitigram-era CV. Schemas in `lib/profile-types.ts` are enforced by zod on load — if the file is malformed the API will return 500 with a useful message.

## Next phases

- **Phase 3** — CV variant generation reweighting `experience_blocks` + `proof_library` against the strategic brief, with PDF/docx export matching the LaTeX layout.
- **Phase 4** — capture diffs between the generated draft and your edits across applications, surfacing learned preferences that flow back into `master_profile.json`.
