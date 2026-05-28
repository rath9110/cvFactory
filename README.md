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
  api/applications/route.ts GET/POST: list sessions / persist full ApplicationSession (creates or upserts)
  api/applications/[id]/route.ts GET/DELETE: load one / remove one
  api/applications/[id]/regenerate/route.ts POST: re-run full pipeline against current master profile (no mutation)
  applications/                browse + detail UI for saved sessions (with regenerate panel)
  api/cv/route.ts          POST: { brief } → { variant, critique, profile_snapshot }
  api/cv/latex/route.ts    POST: { variant } → text/x-tex attachment
  cv-view.tsx              CV preview + critique + .tex download UI
  api/learn/route.ts       GET: aggregate stats + proposed learnings
  api/learn/apply/route.ts POST: { proposal } → appends LearnedPreference to master_profile.json
  api/profile/route.ts     GET: current master profile (used by /profile)
  api/profile/revert-learning/route.ts POST: { learning_id } → removes a LearnedPreference
  profile/                 inspection hub: counts, learnings with revert, tone rules + positioning tensions
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
  letter-compare.ts        section-level edit fractions + score deltas for regeneration view
```

## Editing your master profile

`data/master_profile.json` has `TODO` placeholders. Replace them with the real content from your Mitigram-era CV. Schemas in `lib/profile-types.ts` are enforced by zod on load — if the file is malformed the API will return 500 with a useful message.

## Phase 5 — application history

Navigate to `/applications` (header link on the homepage and `/learn`) to browse every saved session:

- List view: timestamp, job-ad snippet, your verdict, all four critique scores, whether a CV variant was attached.
- Detail view at `/applications/<id>`: full job ad, strategic brief, critique with annotations, the edited cover letter you actually saved, your captured feedback (overall verdict + comment, pattern flags, annotation responses, section notes), and CV variant emphasis notes if attached.
- **Copy letter** copies the final letter to clipboard. **Delete** removes the session file from disk (with a confirm).

The list and detail views are read-only — re-editing a session in place is a candidate for a later pass.

## Phase 6 — regenerate against current profile

On `/applications/<id>` there's a **Regenerate** button that re-runs the entire pipeline (analyzer → cover + critique → CV + critique) against `master_profile.json` as it stands now. The saved session is never mutated.

What you see:
- A `profile_signature` hash so you can tell at a glance whether the master profile has changed since the session was saved.
- Score deltas: how each of the four critique scores moved between saved and regenerated.
- Edit fractions per cover-letter section: how much each section changed.
- Lead-with diff: added (`+`), removed (`−`), unchanged (`=`) framings.
- Side-by-side: the saved final letter vs the freshly regenerated draft.

This is the visible payoff of Phase 4: accept a learning, then regenerate an old session and watch the draft shift.

## Phase 7 — CV editing + persistence parity

The CV variant is now editable in place and persists with the application:

- **Profile summary** is an editable textarea.
- **Experience bullets** edit as newline-separated text per block. Reorder blocks with ↑/↓ buttons.
- **Skills** edit as comma-separated items per category.
- **Apply rewrite** on CV annotations splices the suggested text into the right section (profile_summary / matching experience block / skills row).
- **Download .tex** uses the *edited* variant, not the originally generated one.
- When you click **Save application** in the cover letter section, the CV variant + CV critique ride along into the same `ApplicationSession` record.

On `/applications/<id>`, saved CV variants render as structured content (profile_summary, ordered experience blocks with bullets, skills) plus a per-session **Download .tex** button, so you can re-export an old CV without rerunning generation.

## Phase 8 — master profile hub

`/profile` is the inspection surface for the master profile:

- **Profile content** card: counts of experience blocks, proof points, tone rules, positioning tensions, education, certifications, skill categories, learned preferences.
- **Learned preferences** list (newest first): observation, created_at, confidence badge, source session ids, **Revert** button (with confirm). Reverting removes the entry from `master_profile.json` immediately — past saved sessions still reference it, but future generations won't.
- Read-only reference cards for **active tone rules** and **positioning tensions** so you can sanity-check what every prompt currently runs against.

Reverted learnings will be re-proposed by `/learn` next time if the underlying pattern persists — that's intentional. To kill a proposal permanently you need to either change the pattern (e.g., delete the pattern flags from the sessions that supported it) or hand-edit the profile.

## Phase 9 — deployable

### Storage

Storage is now pluggable. Two backends, auto-detected:

- **Filesystem** (default): `data/master_profile.json` + `data/applications/<id>.json`. What every previous phase used.
- **Upstash Redis** (Vercel-compatible): used whenever `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are set, unless `STORAGE_DRIVER=fs` overrides. Keys: `cvfactory:profile`, `cvfactory:session:<id>`, plus a hash `cvfactory:session_index` mapping id → updated_at for fast listing.

When using Redis on a fresh deployment, the master profile won't exist yet. Either:

1. Locally with filesystem still active, hit `GET /api/profile` to confirm your local `master_profile.json` is healthy, copy its JSON, then on the deployed instance call `POST /api/profile/revert-learning` with a non-existent id to confirm auth works — or more directly, write a one-off script using `@upstash/redis` to `SET cvfactory:profile <your-json>`.
2. Or add a small seed script. Not yet built — current path is to seed Redis manually once.

### Auth

Set `APP_AUTH_TOKEN` to any long random string. With it set:

- Middleware redirects unauthenticated browsers to `/login`, returns 401 to unauthenticated API calls.
- `/login` takes the token, posts to `/api/login`, server sets an HttpOnly Secure SameSite=Strict cookie (`cvf_session`) good for 30 days, redirects back to where you came from.

Without `APP_AUTH_TOKEN`, the app is open — the local-dev default.

### Deploy to Vercel

1. Push to a GitHub repo (this is currently a subdir of another repo — split it first).
2. New Vercel project pointed at the repo, framework auto-detected as Next.js.
3. Add a Redis integration from the Vercel marketplace (Upstash is the supported successor to Vercel KV). It will populate `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` automatically.
4. Set the rest in Project Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` — your key (otherwise mock output ships to production)
   - `APP_AUTH_TOKEN` — a long random string
5. Deploy. Visit `/login`, enter the token, you're in. The first time you generate, you'll get `Master profile not initialised in Redis` until you seed it.

## Known gaps (deferred)

- Bullet-level traceability: today the generator validates only `block_id`s, not individual bullet provenance. Could be tightened to require each variant bullet either matches a master bullet substring or is flagged as a paraphrase.
- Resume editing of a saved session: opening `/applications/<id>` is currently read-only. Re-hydrating analyzer + cover + CV state from a saved session is a candidate for a later pass.
