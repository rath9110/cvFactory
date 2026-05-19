import { callJSON, hasApiKey } from "./anthropic";
import {
  CoverLetter,
  Critique,
  CritiqueSchema,
  MasterProfile,
  StrategicBrief,
} from "./profile-types";

const CRITIQUE_SYSTEM = `You are an honest, strict reviewer of a generated cover letter draft. You see the candidate's master profile (the source of truth for claims), the strategic brief (the positioning decisions), and the draft.

Your job is to flag problems and confirm strengths. You DO NOT rewrite the whole letter. You produce structured annotations and scores.

For each annotation:
- Pick a SHORT exact substring from the draft as target_text. The substring must appear verbatim in the draft so the UI can highlight it.
- Pick the correct target_section: "opening" | "bridge" | "gap_acknowledgement" | "closing".
- Pick the correct issue type:
  - "unsupported_claim": the draft claims something not backed by the master profile or proof library.
  - "generic_platitude": the sentence is a filler / superlative / could appear in anyone's letter.
  - "drift_from_brief": the framing contradicts what brief.lead_with / brief.reframe asked for.
  - "tone_mismatch": violates a tone_rule (overselling, vague adjectives, etc.).
  - "voice_unnatural": something the candidate would not actually say in conversation.
  - "good": a notable strength worth keeping (use sparingly, max 2-3 per draft).
- For non-"good" issues, provide a concrete suggested_rewrite.
- Notes must be one line, specific, and reference the master profile / brief by content (not by id) where relevant.

Score each dimension 1-10 honestly. Do not anchor on 7 to be polite. Use the full range.
- relevance: how well the letter executes the strategic brief
- specificity: concrete vs generic content
- honesty: claims supported by the profile; no overselling
- tone_fit: adherence to the candidate's tone_rules

Output ONLY valid JSON matching the requested schema. No prose before or after.`;

function buildCritiquePrompt(
  profile: MasterProfile,
  brief: StrategicBrief,
  letter: CoverLetter
): string {
  return `# Master profile (source of truth)
\`\`\`json
${JSON.stringify(
  {
    name: profile.name,
    headline: profile.headline,
    proof_library: profile.proof_library,
    tone_rules: profile.tone_rules,
    positioning_tensions: profile.positioning_tensions,
  },
  null,
  2
)}
\`\`\`

# Strategic brief (positioning decisions)
\`\`\`json
${JSON.stringify(brief, null, 2)}
\`\`\`

# Draft cover letter to review
\`\`\`json
${JSON.stringify(letter, null, 2)}
\`\`\`

# Task
Produce a critique as JSON matching this shape:

{
  "scores": {
    "relevance": 1-10,
    "specificity": 1-10,
    "honesty": 1-10,
    "tone_fit": 1-10
  },
  "annotations": [
    {
      "target_section": "opening" | "bridge" | "gap_acknowledgement" | "closing",
      "target_text": "exact verbatim substring from the draft",
      "issue": "unsupported_claim" | "generic_platitude" | "drift_from_brief" | "tone_mismatch" | "voice_unnatural" | "good",
      "note": "one-line specific explanation",
      "suggested_rewrite": "concrete replacement text (omit for 'good')"
    }
  ],
  "verdict": "2-3 sentence overall verdict ending with the single most important thing to fix"
}

Return ONLY the JSON object.`;
}

function mockCritique(letter: CoverLetter): Critique {
  const annotations: Critique["annotations"] = [];

  if (letter.opening) {
    annotations.push({
      target_section: "opening",
      target_text: letter.opening.slice(0, Math.min(60, letter.opening.length)),
      issue: "good",
      note: "Opens on a specific aspect of the job ad rather than a generic enthusiasm line.",
    });
  }

  if (letter.bridge[0]) {
    const t = letter.bridge[0].text;
    annotations.push({
      target_section: "bridge",
      target_text: t.slice(0, Math.min(80, t.length)),
      issue: "good",
      note: "Anchors on the 4 brands / 60+ markets number — concrete and verifiable.",
    });
  }

  if (letter.gap_acknowledgement) {
    annotations.push({
      target_section: "gap_acknowledgement",
      target_text: letter.gap_acknowledgement.slice(
        0,
        Math.min(60, letter.gap_acknowledgement.length)
      ),
      issue: "tone_mismatch",
      note:
        "[MOCK] 'track record of ramping' is slightly soft — strengthen with a specific ramp example.",
      suggested_rewrite:
        "What I bring is a record of ramping into new tools fast — most recently picking up ILM workflows during the Omni-id rollout.",
    });
  }

  if (letter.closing) {
    annotations.push({
      target_section: "closing",
      target_text: letter.closing.slice(0, Math.min(40, letter.closing.length)),
      issue: "generic_platitude",
      note:
        "[MOCK] Closing is okay but could be more concrete about *which* specifics you'd cover.",
      suggested_rewrite:
        "Happy to walk through the consent rollout numbers or the Omni-id identity work — both have specifics the headline does not capture.",
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
      "[MOCK] Draft is honest and anchored on real specifics — the consent rollout and Omni-id references are doing real work. The single most important fix: tighten the gap acknowledgement so the 'ramp' framing has a concrete example attached rather than reading as a soft claim.",
  };
}

export async function critiqueCoverLetter(
  profile: MasterProfile,
  brief: StrategicBrief,
  letter: CoverLetter
): Promise<{ critique: Critique; mocked: boolean }> {
  if (!hasApiKey()) {
    return { critique: mockCritique(letter), mocked: true };
  }

  const raw = await callJSON<unknown>({
    system: CRITIQUE_SYSTEM,
    user: buildCritiquePrompt(profile, brief, letter),
    maxTokens: 3072,
  });

  const parsed = CritiqueSchema.parse(raw);
  return { critique: parsed, mocked: false };
}
