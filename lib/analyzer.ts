import { callJSON, hasApiKey } from "./anthropic";
import {
  MasterProfile,
  StrategicBrief,
  StrategicBriefSchema,
} from "./profile-types";

const ANALYZER_SYSTEM = `You are a strategic application advisor. You analyze a job ad against a candidate's master profile and produce an honest, specific strategic brief.

Rules:
- Never invent experience the candidate does not have in their profile.
- Classify each requirement honestly: strong, partial_reframeable, or gap.
- For partial matches, explain the bridge in plain language.
- For genuine gaps, say so — do not paper over them.
- Reference proof points by their id from the proof_library when relevant.
- Respect the candidate's tone_rules and positioning_tensions when proposing what to lead with.
- Output ONLY valid JSON matching the requested schema. No prose before or after.`;

function buildUserPrompt(profile: MasterProfile, jobAd: string): string {
  return `# Candidate master profile
\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

# Job ad
\`\`\`
${jobAd}
\`\`\`

# Task
Produce a strategic brief as JSON matching this shape:

{
  "job_summary": "2-3 sentence summary of the role and company context",
  "requirements": [
    {
      "id": "r1",
      "text": "the requirement as stated or implied",
      "kind": "must_have" | "nice_to_have" | "implicit_signal",
      "match_status": "strong" | "partial_reframeable" | "gap",
      "reasoning": "why this classification",
      "proof_point_ids": ["proof_library ids that support this, if any"]
    }
  ],
  "lead_with": ["top 2-3 framings to emphasize"],
  "reframe": [{"from": "...", "to": "...", "reason": "..."}],
  "do_not_fake": ["genuine gaps to address transparently"],
  "positioning_memo": "3-5 sentence narrative brief for this application"
}

Return ONLY the JSON object.`;
}

function mockBrief(jobAd: string): StrategicBrief {
  const firstLine = jobAd.split("\n").find((l) => l.trim().length > 0) ?? "the role";
  return {
    job_summary: `[MOCK] Mock summary based on the pasted text. First non-empty line: "${firstLine.slice(0, 120)}".`,
    requirements: [
      {
        id: "r1",
        text: "[MOCK] Multi-stakeholder delivery experience",
        kind: "must_have",
        match_status: "strong",
        reasoning: "Mitigram consent rollout and CDP eval both demonstrate this.",
        proof_point_ids: ["consent-60-markets", "cdp-eval-4brands"],
      },
      {
        id: "r2",
        text: "[MOCK] Deep technical specialism in one named tool",
        kind: "must_have",
        match_status: "gap",
        reasoning: "Profile shows breadth across tools rather than depth in one. Address transparently.",
        proof_point_ids: [],
      },
      {
        id: "r3",
        text: "[MOCK] Cross-market or cross-brand rollout experience",
        kind: "nice_to_have",
        match_status: "strong",
        reasoning: "60+ market consent rollout is a direct, specific match.",
        proof_point_ids: ["consent-60-markets"],
      },
    ],
    lead_with: [
      "Multi-market delivery framing — anchor on the 60+ market number",
      "Cross-brand vendor evaluation as a strategic-judgement signal",
    ],
    reframe: [
      {
        from: "Generic 'program management' framing",
        to: "Specific cross-market regulatory delivery",
        reason: "Concrete framing is more credible than role-title-level abstraction.",
      },
    ],
    do_not_fake: [
      "Deep single-tool specialism — address as adjacent experience plus willingness to ramp",
    ],
    positioning_memo:
      "[MOCK] Lead with the 60+ market consent rollout as the headline proof of multi-stakeholder delivery at scale. Bridge into the CDP vendor evaluation as evidence of structured strategic judgement across complex multi-brand contexts. Address the single-tool depth gap transparently — frame as adjacent experience with a track record of ramping. Close with a forward statement tied to a specific company signal from the ad.",
  };
}

export async function analyzeJobAd(
  profile: MasterProfile,
  jobAd: string
): Promise<{ brief: StrategicBrief; mocked: boolean }> {
  if (!hasApiKey()) {
    return { brief: mockBrief(jobAd), mocked: true };
  }

  const raw = await callJSON<unknown>({
    system: ANALYZER_SYSTEM,
    user: buildUserPrompt(profile, jobAd),
    maxTokens: 4096,
  });

  const parsed = StrategicBriefSchema.parse(raw);
  return { brief: parsed, mocked: false };
}
