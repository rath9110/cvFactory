import { callJSON, hasApiKey } from "./anthropic";
import {
  CVCritique,
  CVCritiqueSchema,
  CVVariant,
  MasterProfile,
  StrategicBrief,
} from "./profile-types";

const CRITIQUE_SYSTEM = `You are a strict reviewer of a tailored CV variant. You see the master profile (the source of truth for claims), the strategic brief (positioning decisions), and the variant. You produce structured annotations and scores.

What to flag:
- "unsupported_claim": variant contains a claim not present in the source master profile block. This is the strictest check — never let invented content slide.
- "generic_platitude": a bullet that has lost its specifics and become generic.
- "drift_from_brief": ordering or emphasis contradicts brief.lead_with / brief.reframe.
- "tone_mismatch": violates tone_rules (overselling, vague adjectives, etc.).
- "voice_unnatural": something the candidate would not actually say.
- "good": notable strength (use sparingly, max 2-3).

Each annotation:
- target_section: "profile_summary" | "experience" | "skills"
- target_block_id: present when target_section == "experience"
- target_text: exact verbatim substring from the variant
- For non-"good" annotations: include a concrete suggested_rewrite.

Score 1-10 honestly. Use the full range.
- relevance: how well the variant executes brief
- specificity: concrete vs generic
- honesty: every claim traceable to the master profile
- tone_fit: adherence to tone_rules

Output ONLY valid JSON. No prose.`;

function buildCritiquePrompt(
  profile: MasterProfile,
  brief: StrategicBrief,
  variant: CVVariant
): string {
  return `# Master profile (source of truth)
\`\`\`json
${JSON.stringify(
  {
    name: profile.name,
    headline: profile.headline,
    profile_summary: profile.profile_summary,
    experience_blocks: profile.experience_blocks,
    proof_library: profile.proof_library,
    tone_rules: profile.tone_rules,
    positioning_tensions: profile.positioning_tensions,
    skills_taxonomy: profile.skills_taxonomy,
  },
  null,
  2
)}
\`\`\`

# Strategic brief
\`\`\`json
${JSON.stringify(brief, null, 2)}
\`\`\`

# CV variant to review
\`\`\`json
${JSON.stringify(variant, null, 2)}
\`\`\`

# Task
Produce a critique as JSON:

{
  "scores": {"relevance": 1-10, "specificity": 1-10, "honesty": 1-10, "tone_fit": 1-10},
  "annotations": [
    {
      "target_section": "profile_summary" | "experience" | "skills",
      "target_block_id": "experience block id (only for experience annotations)",
      "target_text": "verbatim substring",
      "issue": "unsupported_claim" | "generic_platitude" | "drift_from_brief" | "tone_mismatch" | "voice_unnatural" | "good",
      "note": "one-line specific explanation",
      "suggested_rewrite": "concrete replacement (omit for 'good')"
    }
  ],
  "verdict": "2-3 sentence verdict ending with the single most important fix"
}

Return ONLY the JSON.`;
}

function mockCVCritique(variant: CVVariant): CVCritique {
  const firstExp = variant.experience[0];
  const annotations: CVCritique["annotations"] = [
    {
      target_section: "profile_summary",
      target_text: variant.profile_summary.slice(
        0,
        Math.min(60, variant.profile_summary.length)
      ),
      issue: "good",
      note: "Profile leads with the headline numbers — 4 brands, 60+ markets.",
    },
  ];

  if (firstExp && firstExp.bullets[0]) {
    annotations.push({
      target_section: "experience",
      target_block_id: firstExp.block_id,
      target_text: firstExp.bullets[0].slice(0, Math.min(80, firstExp.bullets[0].length)),
      issue: "good",
      note: "First bullet of first block matches a brief.lead_with item — strong placement.",
    });
  }

  if (variant.skills.length > 0) {
    const cat = variant.skills[0].category;
    annotations.push({
      target_section: "skills",
      target_text: cat,
      issue: "drift_from_brief",
      note: "[MOCK] First skills category should match the brief's lead_with theme.",
      suggested_rewrite: "Customer Data & Lifecycle",
    });
  }

  return {
    scores: {
      relevance: 7,
      specificity: 8,
      honesty: 9,
      tone_fit: 7,
    },
    annotations,
    verdict:
      "[MOCK] Variant orders experience by theme overlap but does not yet reword bullets for emphasis. Single most important fix: lead the skills section with the category most aligned to the role's headline requirement.",
  };
}

export async function critiqueCVVariant(
  profile: MasterProfile,
  brief: StrategicBrief,
  variant: CVVariant
): Promise<{ critique: CVCritique; mocked: boolean }> {
  if (!hasApiKey()) {
    return { critique: mockCVCritique(variant), mocked: true };
  }

  const raw = await callJSON<unknown>({
    system: CRITIQUE_SYSTEM,
    user: buildCritiquePrompt(profile, brief, variant),
    maxTokens: 4096,
  });

  const parsed = CVCritiqueSchema.parse(raw);
  return { critique: parsed, mocked: false };
}
