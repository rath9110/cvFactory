import { z } from "zod";
import { callJSON, hasApiKey } from "./anthropic";
import {
  ApplicationSession,
  LearningProposal,
  LearningProposalSchema,
} from "./profile-types";
import {
  AggregateStats,
  SessionSummary,
  stableProposalId,
} from "./learn-aggregator";

const DETECTOR_SYSTEM = `You analyze a user's history of cover letter applications. Each application has: the generated draft, the user's edited version, the auto-critique's annotations, and the user's responses (accept/reject/ignore) plus free-text feedback.

Your job is to find PATTERNS the deterministic aggregator cannot: subtle voice preferences, recurring rewrites, consistent emphasis shifts, blind spots in the generator.

Rules:
- Propose only what the data supports. Never extrapolate beyond what is observed.
- Each proposal must cite at least one session id as evidence.
- Phrase observations as rules the user would write in their master profile — actionable, concise, in their voice.
- Do not duplicate proposals the aggregator has already produced — you will see them and should produce different ones (more nuanced, voice-level, cross-section).
- Skip if you find nothing strong enough to propose.

Output ONLY valid JSON matching the requested schema. No prose before or after.`;

const ResponseSchema = z.object({
  proposals: z.array(
    z.object({
      observation: z.string(),
      rationale: z.string(),
      evidence_session_ids: z.array(z.string()).min(1),
    })
  ),
});

type SessionDigest = {
  id: string;
  job_summary: string;
  brief_lead_with: string[];
  edits: SessionSummary["section_edit_fractions"];
  scores: SessionSummary["scores"];
  verdict: SessionSummary["verdict"];
  overall_comment: string;
  pattern_flags: string[];
  rejected_annotations: { section: string; text: string; issue: string }[];
  accepted_annotations: { section: string; text: string; issue: string }[];
};

function digestSession(session: ApplicationSession): SessionDigest {
  const responseByKey = new Map<string, string>();
  for (const r of session.feedback.annotation_responses) {
    responseByKey.set(
      `${r.annotation_section}::${r.annotation_target_text}`,
      r.response
    );
  }

  const rejected: SessionDigest["rejected_annotations"] = [];
  const accepted: SessionDigest["accepted_annotations"] = [];
  for (const ann of session.critique.annotations) {
    const resp = responseByKey.get(`${ann.target_section}::${ann.target_text}`);
    if (resp === "reject") {
      rejected.push({
        section: ann.target_section,
        text: ann.target_text,
        issue: ann.issue,
      });
    } else if (resp === "accept") {
      accepted.push({
        section: ann.target_section,
        text: ann.target_text,
        issue: ann.issue,
      });
    }
  }

  return {
    id: session.id,
    job_summary: session.brief.job_summary,
    brief_lead_with: session.brief.lead_with,
    edits: {
      opening: 0,
      bridge_avg: 0,
      gap_acknowledgement: 0,
      closing: 0,
    },
    scores: session.critique.scores,
    verdict: session.feedback.overall_verdict,
    overall_comment: session.feedback.overall_comment,
    pattern_flags: session.feedback.pattern_flags,
    rejected_annotations: rejected,
    accepted_annotations: accepted,
  };
}

function buildPrompt(
  sessions: ApplicationSession[],
  stats: AggregateStats,
  existingProposals: LearningProposal[]
): string {
  const digests = sessions.map(digestSession);
  return `# Aggregate stats
\`\`\`json
${JSON.stringify(stats, null, 2)}
\`\`\`

# Session digests
\`\`\`json
${JSON.stringify(digests, null, 2)}
\`\`\`

# Proposals the aggregator already produced (DO NOT duplicate)
\`\`\`json
${JSON.stringify(
  existingProposals.map((p) => ({ observation: p.observation, rationale: p.rationale })),
  null,
  2
)}
\`\`\`

# Task
Return JSON:

{
  "proposals": [
    {
      "observation": "rule phrased in user's voice",
      "rationale": "what evidence supports this",
      "evidence_session_ids": ["..."]
    }
  ]
}

If no patterns rise to a proposal, return {"proposals": []}.`;
}

function mockLLMProposals(
  sessions: ApplicationSession[],
  stats: AggregateStats
): LearningProposal[] {
  const proposals: LearningProposal[] = [];

  if (sessions.length === 0) return proposals;

  const lowest = (Object.entries(stats.avg_scores) as [string, number][])
    .sort((a, b) => a[1] - b[1])[0];
  if (lowest && lowest[1] < 8) {
    const obs = `Tighten draft generation for '${lowest[0]}' — it scores lowest across the recent application set.`;
    proposals.push({
      id: stableProposalId("llm", obs),
      observation: obs,
      rationale: `[MOCK] Avg '${lowest[0]}' score across ${sessions.length} session(s) is ${lowest[1].toFixed(1)}/10 — the lowest of the four dimensions.`,
      evidence_session_ids: stats.session_ids,
      source: "llm",
    });
  }

  const feltOff = stats.verdict_counts.felt_off ?? 0;
  if (feltOff > 0) {
    const obs = `Review sessions you marked 'felt off' before generating next time — they likely share a positioning trait the brief missed.`;
    proposals.push({
      id: stableProposalId("llm", obs),
      observation: obs,
      rationale: `[MOCK] ${feltOff} session(s) marked 'felt off' — a common cause is the strategic brief leading with the wrong angle.`,
      evidence_session_ids: sessions
        .filter((s) => s.feedback.overall_verdict === "felt_off")
        .map((s) => s.id),
      source: "llm",
    });
  }

  return proposals;
}

export async function detectPatterns(
  sessions: ApplicationSession[],
  stats: AggregateStats,
  existingProposals: LearningProposal[]
): Promise<{ proposals: LearningProposal[]; mocked: boolean }> {
  if (sessions.length === 0) return { proposals: [], mocked: false };
  if (!hasApiKey()) {
    return { proposals: mockLLMProposals(sessions, stats), mocked: true };
  }

  const raw = await callJSON<unknown>({
    system: DETECTOR_SYSTEM,
    user: buildPrompt(sessions, stats, existingProposals),
    maxTokens: 3072,
  });
  const parsed = ResponseSchema.parse(raw);

  const proposals: LearningProposal[] = parsed.proposals.map((p) => ({
    id: stableProposalId("llm", p.observation),
    observation: p.observation,
    rationale: p.rationale,
    evidence_session_ids: p.evidence_session_ids,
    source: "llm",
  }));
  return {
    proposals: proposals.map((p) => LearningProposalSchema.parse(p)),
    mocked: false,
  };
}
