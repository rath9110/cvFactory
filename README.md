# CV Factory

A strategic CV and cover letter generator with feedback loops. Built around a stable **master profile** that gets reweighted per application, not a one-shot generator.

## Phases

1. **Master profile + job ad analyzer → strategic brief** ← _you are here_
2. Cover letter generation with self-critique
3. CV variant generation + PDF export
4. Feedback loop with learned preferences

## Phase 1 — what it does

Paste a job ad. The analyzer:

- Extracts requirements (must-haves, nice-to-haves, implicit signals)
- Classifies each against your master profile: **strong**, **partial — reframeable**, **gap**
- Produces a positioning memo: what to lead with, what to reframe, what not to fake

The output is a brief you read **before** writing anything. That alone reshapes the application.

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
  analyzer-client.tsx      paste-and-render UI
  api/analyze/route.ts     POST endpoint: job ad → strategic brief
  globals.css              tailwind entry
  layout.tsx               root layout
data/
  master_profile.json      the single source of truth — edit by hand for now
lib/
  profile-types.ts         zod schemas + types for profile and brief
  load-profile.ts          read+validate master_profile.json
  anthropic.ts             SDK wrapper, mock-fallback helpers
  analyzer.ts              prompt + analyzer entrypoint
```

## Editing your master profile

`data/master_profile.json` has `TODO` placeholders. Replace them with the real content from your Mitigram-era CV. Schemas in `lib/profile-types.ts` are enforced by zod on load — if the file is malformed the API will return 500 with a useful message.

## Next phases

Phases 2–4 wire onto the same brief output. Start there before adding generation.
