// Relative imports carry .ts so Node can run tests/cv-materialise.test.ts directly.
import { callJSON, hasApiKey } from "./anthropic.ts";
import { jaccardSimilarity } from "./diff.ts";
import { profileContext, sourceBullets } from "./profile-context.ts";
import { CVSelectionSchema } from "./profile-types.ts";
import type {
  CVSelection,
  CVVariant,
  MasterProfile,
  StrategicBrief,
} from "./profile-types.ts";

const GENERATOR_SYSTEM = `You are tailoring a CV for a specific role. You SELECT from the candidate's master profile — you do not rewrite it.

How selection works:
- Each experience block in the master profile has a "bullets" array. You choose which of those bullets appear, and in what order, by their INDEX. You never retype the bullet text.
- Selecting is the main lever. Lead each block with the bullets that speak to the brief's lead_with list, and leave out the ones that do not earn their space on this application. A shorter, sharper block beats a complete one.
- experience_order decides which roles appear first. Lead with roles whose transferable_themes overlap most with the brief.

How much to keep — this is a two-page document, not an archive:
- The most relevant one or two roles carry 4-6 bullets. Mid-relevance roles get 2-3. Older or off-topic roles get 1-2, and a role with nothing to say to this brief can be left out of experience_order entirely.
- Keeping every bullet is not a safe default, it is a failure to choose. If two bullets make the same point, keep the one with the number in it.
- Prefer bullets carrying a figure, a named system, a market or a team over bullets describing duties.

Rewording, when it is genuinely needed:
- Use "rewrites" to shift emphasis on a bullet you have selected: a different verb, a tighter phrasing, the relevant half of the bullet foregrounded.
- A rewrite carries the SAME FACTS as the bullet it replaces. No new metric, tool, scope, employer or outcome. If a rewrite would need a fact the original bullet does not contain, do not write it.
- Most bullets need no rewrite. Reach for it deliberately, not by default.

Rewrite any selected bullet that breaks the house style below. The source material was not written to these rules, and a bullet you select carries its faults onto the page:
- An em dash becomes a full stop, a comma, or parentheses for scope.
- A bullet carrying two ideas keeps the stronger one. Drop the weaker half rather than splitting it — one selected bullet produces one bullet on the page.
- A bullet running past two lines gets cut to the outcome and the scope.
- A hedge or filler opener becomes the plain verb: "Responsible for the coordination of" becomes "Coordinated".
These rewrites drop words. They never add facts, and they never add a figure that was not already in the bullet.

House style. These are hard rules for anything you write yourself — the profile_summary and any rewrite:
- Never invent a number. Every figure must already appear in the source you are drawing from. No estimates, no rounding, no "approximately". A generation containing an untraceable figure is rejected outright.
- No em dashes. Anywhere. A full stop, a comma, or parentheses for scope.
- No hedges: "helped support", "was involved in", "contributed to", "part of the team that". If the person owned it, say so.
- No filler around a real verb. "Coordinated", never "Responsible for the coordination of".
- No inflated vocabulary: leverage, spearheaded, passionate about, results-driven, seasoned, dynamic, synergy, robust, holistic, deep dive, journey.
- No three-item adjective strings. "Strategic, analytical and collaborative" says nothing.
- No abstract nouns in the summary: future, meaning, change, balance, opportunities, impact, excellence, growth mindset.
- No "not just X, but Y".
- No warm-up opener. Never "Experienced professional with a strong background in". Start with what the person does.

Bullet shape, which governs both selection and rewrites:
- Outcome first, method after. The first six words carry the point.
- One idea per bullet. Two ideas means two bullets, or one gets cut.
- Verb first, past tense, no pronoun.
- Name the specifics: systems, brands, markets, team size. Parentheses work well for scope, like "(4 brands, 60+ markets)".
- A bullet that only describes a responsibility is a job description, not a CV. When choosing between two bullets, take the one that says what happened.

Other fields:
- profile_summary is the candidate's master profile_summary, REFRAMED for this application. Same facts, different angle. 3-5 sentences. It must fail the swap test: if the summary would still read true with someone else's name on it, it is too generic to use.
- skills are filtered and reordered per the brief — include categories and items that match the role, drop categories that don't. Never invent a skill.
- emphasis_notes is one or two sentences on what you emphasised versus de-emphasised, and why.

Output ONLY valid JSON matching the requested schema. No prose before or after.`;

function buildUserPrompt(
  profile: MasterProfile,
  brief: StrategicBrief
): string {
  const blockIds = profile.experience_blocks.map((b) => b.id);
  const skillCategories = profile.skills_taxonomy.map((s) => s.category);

  return `# Strategic brief (positioning decisions)
\`\`\`json
${JSON.stringify(brief)}
\`\`\`

# Constraints
- experience_order MUST be a subset of these ids, in the order the roles should appear: ${JSON.stringify(blockIds)}
- Every experience.block_id MUST appear in experience_order.
- bullets are INDICES into that block's "bullets" array in the master profile above. Index 0 is the first entry. Never write bullet text in this field.
- skills.category values SHOULD come from this list (in any order, may omit): ${JSON.stringify(skillCategories)}

# Task
Select and order the CV. Return JSON:

{
  "profile_summary": "3-5 sentence profile, same facts as the master profile_summary, reframed for this role",
  "experience_order": ["block_id_in_order"],
  "experience": [
    {
      "block_id": "...",
      "bullets": [3, 0, 5],
      "rewrites": {"3": "same bullet, emphasis shifted for this role"}
    }
  ],
  "skills": [
    {"category": "...", "items": ["..."]}
  ],
  "emphasis_notes": "1-2 sentence note on what was emphasized vs. de-emphasized"
}

Return ONLY the JSON object.`;
}

function mockCVSelection(profile: MasterProfile, brief: StrategicBrief): CVSelection {
  const leadThemes = brief.lead_with.join(" ").toLowerCase();

  const sortedBlocks = [...profile.experience_blocks].sort((a, b) => {
    const aScore = a.transferable_themes.reduce(
      (acc, t) => acc + (leadThemes.includes(t.toLowerCase()) ? 1 : 0),
      0
    );
    const bScore = b.transferable_themes.reduce(
      (acc, t) => acc + (leadThemes.includes(t.toLowerCase()) ? 1 : 0),
      0
    );
    return bScore - aScore;
  });

  return {
    profile_summary: `[MOCK] ${profile.profile_summary}`,
    experience_order: sortedBlocks.map((b) => b.id),
    experience: sortedBlocks.map((b) => ({
      block_id: b.id,
      // Mock selects every bullet, in source order, and rewrites nothing.
      bullets: sourceBullets(b).map((_, i) => i),
      rewrites: {},
    })),
    skills: profile.skills_taxonomy.map((s) => ({
      category: s.category,
      items: [...s.items],
    })),
    emphasis_notes:
      "[MOCK] Reordered experience by overlap of transferable_themes with brief.lead_with. All bullets selected, none reworded.",
  };
}

/**
 * A rewrite must stay recognisably the bullet it claims to rewrite. Compared
 * against that one source bullet rather than the whole block, so swapping a
 * bullet's text for a different bullet's content is caught too.
 */
const REWRITE_PROVENANCE_THRESHOLD = 0.34;

/**
 * Every figure written into a CV has to be traceable to the master profile.
 *
 * Bullets are safe by construction — they are selected by index, so their
 * numbers are the profile's numbers. The two places free text still reaches the
 * page are `rewrites` and `profile_summary`, and this is what guards them: a
 * figure that does not appear in the source it claims to come from means the
 * model rounded, estimated or invented, and the generation is rejected.
 */
function numbersIn(text: string): string[] {
  return (text.match(/\d[\d.,]*/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));
}

function untraceableNumber(candidate: string, source: string): string | null {
  const sourceNumbers = new Set(numbersIn(source));
  for (const n of numbersIn(candidate)) {
    if (!sourceNumbers.has(n)) return n;
  }
  return null;
}

/** Items the model returns must exist somewhere in the profile's taxonomy. */
function filterInventedSkills(
  skills: CVVariant["skills"],
  profile: MasterProfile
): CVVariant["skills"] {
  const known = new Map<string, string>();
  for (const group of profile.skills_taxonomy) {
    for (const item of group.items) known.set(item.trim().toLowerCase(), item);
  }
  return skills
    .map((group) => ({
      category: group.category,
      items: group.items
        .map((item) => known.get(item.trim().toLowerCase()))
        .filter((item): item is string => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);
}

/**
 * Turns a selection into the CVVariant the rest of the app stores, edits and
 * renders. Every bullet's text comes from the profile here — the model's output
 * only decided which ones and in what order.
 *
 * Throws on anything the format cannot make safe: an unknown block, an index
 * that isn't in the block, or a rewrite that has drifted off its source bullet.
 */
export function materialiseVariant(
  selection: CVSelection,
  profile: MasterProfile
): CVVariant {
  const blocksById = new Map(profile.experience_blocks.map((b) => [b.id, b]));

  for (const blockId of selection.experience_order) {
    if (!blocksById.has(blockId)) {
      throw new Error(`Generator returned unknown experience block id: ${blockId}`);
    }
  }

  const experience = selection.experience.map((exp) => {
    const block = blocksById.get(exp.block_id);
    if (!block) {
      throw new Error(`Generator returned unknown experience block id: ${exp.block_id}`);
    }
    const source = sourceBullets(block);

    const bullets = exp.bullets.map((index) => {
      const original = source[index];
      if (original === undefined) {
        throw new Error(
          `Generator selected bullet ${index} of block '${exp.block_id}', which has ${source.length} bullets`
        );
      }
      const rewrite = exp.rewrites[String(index)];
      if (rewrite === undefined) return original;

      const trimmed = rewrite.trim();
      if (trimmed.length === 0) return original;
      if (jaccardSimilarity(trimmed, original) < REWRITE_PROVENANCE_THRESHOLD) {
        throw new Error(
          `Rewrite of bullet ${index} in block '${exp.block_id}' has drifted from its source: "${trimmed}"`
        );
      }
      const invented = untraceableNumber(trimmed, original);
      if (invented !== null) {
        throw new Error(
          `Rewrite of bullet ${index} in block '${exp.block_id}' introduces the figure "${invented}", which is not in the source bullet`
        );
      }
      return trimmed;
    });

    return { block_id: exp.block_id, bullets };
  });

  const inventedInSummary = untraceableNumber(
    selection.profile_summary,
    JSON.stringify(profile)
  );
  if (inventedInSummary !== null) {
    throw new Error(
      `Profile summary contains the figure "${inventedInSummary}", which appears nowhere in the master profile`
    );
  }

  return {
    profile_summary: selection.profile_summary,
    experience_order: selection.experience_order,
    experience,
    skills: filterInventedSkills(selection.skills, profile),
    emphasis_notes: selection.emphasis_notes,
  };
}

export async function generateCVVariant(
  profile: MasterProfile,
  brief: StrategicBrief
): Promise<{ variant: CVVariant; mocked: boolean }> {
  if (!hasApiKey()) {
    return { variant: materialiseVariant(mockCVSelection(profile, brief), profile), mocked: true };
  }

  const raw = await callJSON<unknown>({
    cachedContext: profileContext(profile),
    system: GENERATOR_SYSTEM,
    user: buildUserPrompt(profile, brief),
    maxTokens: 2048,
  });

  const selection = CVSelectionSchema.parse(raw);
  return { variant: materialiseVariant(selection, profile), mocked: false };
}
