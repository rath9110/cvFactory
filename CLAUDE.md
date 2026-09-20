# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # next dev on http://localhost:3000
npm run build          # production build (also the only full type-check of route types)
npm run start          # serve the production build
npm run typecheck      # tsc --noEmit (tsconfig is strict) — the main verification step
```

There is **no test suite and no test runner** in this project, and `npm run lint` (`next lint`) has no ESLint config — it will drop into Next's interactive setup rather than lint. Verification today means `npm run typecheck`, `npm run build`, and exercising the flow against `npm run dev` (the mock mode makes that free).

Env: copy `.env.example` → `.env.local`. Everything in it is optional; with no vars set the app runs open (no auth), stores to the filesystem, and returns **mock** LLM output.

## The one idea behind the codebase

`data/master_profile.json` is the single source of truth about the candidate. Nothing in the pipeline invents content — every generator reweights, reorders, or reframes material that already exists in that file, and feedback loops back into it as `learned_preferences`. Read `lib/profile-types.ts` first: it is the zod schema layer that every other module, API route, and client component is typed from.

## Pipeline

Job ad → **analyzer** (`lib/analyzer.ts`) → `StrategicBrief` → two parallel branches, both driven by that brief:

- **Cover letter**: `lib/cover-generator.ts` → `lib/critique.ts` (self-critique: scores + annotations + suggested rewrites)
- **CV variant**: `lib/cv-generator.ts` → `lib/cv-critique.ts`, then `lib/latex-template.ts` renders `.tex`

The user edits both in place, answers the critique (accept/reject/ignore per annotation, section notes, pattern flags, overall verdict), and saves the whole thing as one `ApplicationSession`.

Then the loop closes: `lib/learn-aggregator.ts` (deterministic, threshold-based) and `lib/pattern-detector.ts` (LLM, nuanced) read across all saved sessions and propose `LearnedPreference` entries. Accepting one appends it to the master profile — which every prompt includes — so future generations shift. `/applications/<id>` → **Regenerate** re-runs the whole pipeline against the current profile and diffs it against what was saved (`lib/letter-compare.ts`, `lib/diff.ts`).

## Conventions that matter

**Every LLM module has the same shape.** System prompt constant → `buildUserPrompt()` → a `mockX()` function → an exported entrypoint that returns `{ result, mocked: boolean }`. The entrypoint returns the mock when `hasApiKey()` is false, otherwise calls `callJSON()` and validates the response with the zod schema. The `mocked` flag propagates up through the API route to the UI, which shows an amber "mock output" banner. Follow this shape exactly when adding a stage — the mocks are what makes the app developable without a key, so they must stay realistic and stay schema-valid.

`lib/anthropic.ts` holds the client and `MODEL_ID`. `callJSON()` asks for raw JSON and extracts the first `{` … last `}` from the text block; prompts therefore end with "Return ONLY the JSON object."

**Validation happens twice, deliberately.** API routes parse the request body with zod (`safeParse`, 400 with joined issue messages on failure), and `lib/storage.ts` re-validates with `MasterProfileSchema` / `ApplicationSessionSchema` on *both* read and write. Generators additionally do semantic validation the schema can't express. `cv-generator.ts` enforces three rules the prompt only asks for politely:

1. every `block_id` / `experience_order` entry must exist in the profile (throws),
2. every bullet must reach `BULLET_PROVENANCE_THRESHOLD` (0.34) token overlap with some bullet in its *source* block, else it was invented (throws),
3. skill items not present anywhere in `skills_taxonomy` are filtered out, and emptied groups dropped (silent — a stray skill shouldn't cost a whole generation).

The 0.34 threshold sits in a wide empirical gap: against the real profile, verbatim bullets score 1.0, a rewording 0.93, an aggressive halving 0.54, while fabrications and bullets borrowed from a *different* block score 0.04–0.14.

**Listing never validates; loading does.** `listSessions` returns every session id it can see (reading `updated_at` leniently, falling back to file mtime) so that a session which fails the schema is still visible to callers. `loadSession` is the single validation point, and callers decide what to do with a failure — `GET /api/learn` skips them and reports the ids in `skipped_session_ids`, which the learning page renders as a banner. Never reintroduce silent dropping at the listing layer.

**Consequence when changing `ApplicationSessionSchema`:** already-saved sessions must still parse. New fields need `.optional()` or `.default()`, or existing session files/keys become unreadable. `GET /api/learn` loads *every* session, so one unparseable session breaks the whole learning page (the fs `listSessions` skips malformed files, but `loadSession` throws).

**Storage is driver-agnostic** (`lib/storage.ts`): filesystem by default, Upstash Redis when `UPSTASH_REDIS_REST_URL` is set, `STORAGE_DRIVER` overrides. Never touch `fs` or Redis directly from a route — go through `lib/load-profile.ts` / `lib/applications.ts`. Both drivers run ids through `assertId()` (path-traversal guard) and the Redis driver mirrors fs semantics, including throwing an `ENOENT`-coded error for a missing session so routes can map it to a 404.

All API routes declare `export const runtime = "nodejs"` — required by the fs driver and `crypto`.

**Auth is an on/off switch, not a user system.** `middleware.ts` + `lib/auth.ts`: with `APP_AUTH_TOKEN` set, unauthenticated browsers redirect to `/login` and API calls get 401; without it, `cookieMatches()` returns true and the app is open. The session cookie value *is* the token, compared in constant time.

**Client components hold the editable state.** Pages under `app/` are thin server components; the `*-client.tsx` / `*-view.tsx` files are `"use client"` and own the state. `analyzer-client.tsx` coordinates: it renders `CVView` and `CoverLetterView` side by side and passes a `getCVPayload` callback (backed by a ref, so CV edits don't re-render the letter) — that is how a CV variant rides along into the same `ApplicationSession` when the user clicks **Save application** in the cover-letter section.

**Annotations are located by substring.** `target_text` must be an exact verbatim substring of the generated section; "Apply rewrite" splices `suggested_rewrite` into the edited textarea by matching it. Prompts that produce annotations must keep insisting on verbatim quoting.

## Data and privacy

`data/applications/` is git-ignored — saved sessions contain real job ads and the user's own edits. `data/master_profile.json` **is** committed and contains real personal data; treat it as the user's CV, not fixture data.

## Export

Three formats, all pure `(artefact, MasterProfile) → string` renderers with no I/O:

- `lib/latex-template.ts` → `.tex` (CV only), mirroring an existing Mitigram-style template; everything interpolated goes through `escapeLatex()`. Compilation stays out of process — the `.tex` file is the artifact.
- `lib/export-document.ts` → HTML for both the letter and the CV, in one stylesheet shared by two wrappers: `wordDocument()` adds the Office namespaces that make Word open it as a document (`.doc`, `application/msword`), `printDocument()` adds an A4 sheet preview and print CSS. Everything interpolated goes through `escapeHtml()`.
- `POST /api/export` takes exactly one of `{ letter }` or `{ variant }` plus `format: "doc" | "print"`, and always re-reads the profile server-side for the letterhead — the client never supplies contact details.

**PDF is produced by the browser, not the server**: `openPdfPrintView()` in `lib/client-export.ts` opens the print view and raises the print dialog, where "Save as PDF" writes a true vector PDF. That avoids a headless-Chrome or PDF-layout dependency in a serverless deployment. The pop-up window must be opened *synchronously* inside the click handler — opening it after the `await` gets blocked.
