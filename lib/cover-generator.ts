import { callJSON, hasApiKey } from "./anthropic";
import {
  CoverLetter,
  CoverLetterSchema,
  MasterProfile,
  StrategicBrief,
} from "./profile-types";

const GENERATOR_SYSTEM = `You are an honest, specific cover letter writer working from a candidate's master profile and a strategic brief.

Hard rules:
- Never invent experience, claims, metrics, or details not present in the master profile.
- Reference specific proof points (by their concrete claims, not by id) where they strengthen a paragraph.
- Lead with the angles named in the brief's "lead_with" list — these were chosen for this application.
- Reframe per the brief's "reframe" list.
- Address genuine gaps (brief.do_not_fake) honestly, in a single short paragraph, via adjacent experience or willingness to ramp. If no gap is significant enough to warrant a paragraph, omit gap_acknowledgement entirely.
- Apply the candidate's tone_rules. The candidate explicitly wants: specifics over superlatives, no overselling, show-don't-tell, business outcomes tied to concrete artefacts.
- The opening must contain a real connection point to *this* company (drawn from the job ad), not a generic "I am excited to apply" line.
- The closing must be a concrete forward statement, not a thank-you line.

Length:
- Opening: 1 short paragraph (2-3 sentences)
- Bridge: 1-3 paragraphs, each 2-4 sentences
- Gap acknowledgement: at most 1 short paragraph (omit if not needed)
- Closing: 1-2 sentences
- Total: aim for 250-400 words.

Output ONLY valid JSON matching the requested schema. No prose before or after.`;

function buildUserPrompt(
  profile: MasterProfile,
  brief: StrategicBrief,
  jobAd: string
): string {
  return `# Master profile
\`\`\`json
${JSON.stringify(profile, null, 2)}
\`\`\`

# Strategic brief (the positioning decisions for this application)
\`\`\`json
${JSON.stringify(brief, null, 2)}
\`\`\`

# Job ad
\`\`\`
${jobAd}
\`\`\`

# Task
Write a cover letter as JSON matching this shape:

{
  "recipient": "Hiring team or specific person if inferable, else omit",
  "opening": "Genuine connection-to-company paragraph (2-3 sentences)",
  "bridge": [
    {
      "text": "Paragraph text",
      "proof_point_ids": ["ids from master_profile.proof_library actually referenced here"]
    }
  ],
  "gap_acknowledgement": "Optional: transparent acknowledgement of a genuine gap from brief.do_not_fake — only if a gap warrants explicit naming",
  "closing": "Concrete forward statement (1-2 sentences)",
  "signoff": "Best regards,\\n${profile.name}"
}

Return ONLY the JSON object.`;
}

function mockCoverLetter(brief: StrategicBrief): CoverLetter {
  const firstLead = brief.lead_with[0] ?? "multi-market customer-data delivery";
  return {
    opening: `[MOCK] The work you describe — building consent and identity infrastructure across European markets — maps directly onto what I do today. The specific mention of CDP vendor evaluation and multi-market rollouts caught my eye because that has been the actual shape of my last two years.`,
    bridge: [
      {
        text: `[MOCK] I currently lead the horizontal delivery of customer data and MarTech across four H&M Group brands (COS, ARKET, &Other Stories, Weekday) in 60+ markets, sitting at the bridge between global operations and local market execution. The headline of that work has been rolling out a consent and first-party data architecture across COS and ARKET that materially expanded the marketable base — done in close dialogue with Legal, Privacy, and Commercial.`,
        proof_point_ids: ["consent-60-markets", "consent-architecture-rollout"],
      },
      {
        text: `[MOCK] Before that I led ARKET's e-commerce re-platforming and the rollout of "Omni-id", an identity resolution initiative unifying online and offline customer data into a single profile. That work taught me what identity resolution actually costs when you take it seriously — and what it unlocks downstream for personalisation and CRM targeting. ${firstLead} is the angle I would lead with for your role.`,
        proof_point_ids: ["omni-id-identity-resolution", "arket-replatform-delivery"],
      },
    ],
    gap_acknowledgement: `[MOCK] I would not claim deep single-vendor specialism in any one CDP — my exposure has been across the CRM/CDP/ILM stack as an operator, not as a vendor specialist. What I bring is a track record of ramping into the systems that matter for the decision in front of the business.`,
    closing: `[MOCK] Happy to walk through the consent rollout or the Omni-id work in more depth — both have specifics that may be more relevant than the headline.`,
    signoff: `Best regards,\nRasmus Thunberg`,
  };
}

export async function generateCoverLetter(
  profile: MasterProfile,
  brief: StrategicBrief,
  jobAd: string
): Promise<{ letter: CoverLetter; mocked: boolean }> {
  if (!hasApiKey()) {
    return { letter: mockCoverLetter(brief), mocked: true };
  }

  const raw = await callJSON<unknown>({
    system: GENERATOR_SYSTEM,
    user: buildUserPrompt(profile, brief, jobAd),
    maxTokens: 4096,
  });

  const parsed = CoverLetterSchema.parse(raw);
  return { letter: parsed, mocked: false };
}
