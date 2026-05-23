import { callJSON, hasApiKey } from "./anthropic";
import {
  CVVariant,
  CVVariantSchema,
  MasterProfile,
  StrategicBrief,
} from "./profile-types";

const GENERATOR_SYSTEM = `You are tailoring a CV for a specific role. You work from a candidate's master profile and a strategic brief. You produce a structured CV variant, not free-form text.

Hard rules:
- Bullets may be REORDERED or SUBTLY REWORDED relative to the master profile. They MUST NOT introduce new claims, metrics, tools, or scope not present in the source experience block.
- Reordering is the primary lever — lead each block with the bullets most relevant to the brief's lead_with list.
- Subtle rewording means: shifting emphasis, changing the verb, tightening — NOT adding new information.
- experience_order controls which roles appear first. Lead with roles whose transferable_themes overlap most with the brief.
- profile_summary is the candidate's master profile_summary, REFRAMED for this application. Same facts, different angle. 3-5 sentences.
- skills should be filtered and reordered per the brief — include categories and items that match the role, drop categories that don't. Never invent skills.
- emphasis_notes is one or two sentences explaining what you emphasized vs. de-emphasized and why.

Output ONLY valid JSON matching the requested schema. No prose before or after.`;

function buildUserPrompt(
  profile: MasterProfile,
  brief: StrategicBrief
): string {
  const blockIds = profile.experience_blocks.map((b) => b.id);
  const skillCategories = profile.skills_taxonomy.map((s) => s.category);

  return `# Candidate master profile
\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

# Strategic brief (positioning decisions)
\`\`\`json
${JSON.stringify(brief, null, 2)}
\`\`\`

# Constraints
- experience_order MUST be a permutation/subset of these ids: ${JSON.stringify(blockIds)}
- skills.category values SHOULD come from this list (in any order, may omit): ${JSON.stringify(skillCategories)}
- Every experience.block_id MUST exist in master_profile.experience_blocks

# Task
Produce a CV variant as JSON:

{
  "profile_summary": "3-5 sentence profile reframed for this role",
  "experience_order": ["block_id_in_order"],
  "experience": [
    {
      "block_id": "...",
      "bullets": ["tailored bullets, derived from the block's responsibilities + outcomes, reordered/lightly reworded"]
    }
  ],
  "skills": [
    {"category": "...", "items": ["..."]}
  ],
  "emphasis_notes": "1-2 sentence note on what was emphasized vs. de-emphasized"
}

Return ONLY the JSON object.`;
}

function mockCVVariant(profile: MasterProfile, brief: StrategicBrief): CVVariant {
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
      bullets: [...b.outcomes, ...b.responsibilities],
    })),
    skills: profile.skills_taxonomy.map((s) => ({
      category: s.category,
      items: [...s.items],
    })),
    emphasis_notes:
      "[MOCK] Reordered experience by overlap of transferable_themes with brief.lead_with. Bullets and skills passed through verbatim — no rewording in mock mode.",
  };
}

export async function generateCVVariant(
  profile: MasterProfile,
  brief: StrategicBrief
): Promise<{ variant: CVVariant; mocked: boolean }> {
  if (!hasApiKey()) {
    return { variant: mockCVVariant(profile, brief), mocked: true };
  }

  const raw = await callJSON<unknown>({
    system: GENERATOR_SYSTEM,
    user: buildUserPrompt(profile, brief),
    maxTokens: 6144,
  });

  const parsed = CVVariantSchema.parse(raw);

  const validBlockIds = new Set(profile.experience_blocks.map((b) => b.id));
  for (const blockId of parsed.experience_order) {
    if (!validBlockIds.has(blockId)) {
      throw new Error(`Generator returned unknown experience block id: ${blockId}`);
    }
  }
  for (const exp of parsed.experience) {
    if (!validBlockIds.has(exp.block_id)) {
      throw new Error(`Generator returned unknown experience block id: ${exp.block_id}`);
    }
  }

  return { variant: parsed, mocked: false };
}
