import { createHash } from "crypto";
import { editFraction } from "./diff";
import {
  ANNOTATION_ISSUES,
  AnnotationIssue,
  ApplicationSession,
  LearningProposal,
  OVERALL_VERDICTS,
  OverallVerdict,
} from "./profile-types";

export type SectionEditStats = {
  opening: number;
  gap_acknowledgement: number;
  closing: number;
  bridge_avg: number;
};

export type AnnotationStatsByIssue = Record<
  AnnotationIssue,
  {
    total: number;
    accepted: number;
    rejected: number;
    ignored: number;
    no_response: number;
  }
>;

export type PatternFlagAggregate = {
  text: string;
  count: number;
  session_ids: string[];
};

export type AggregateStats = {
  session_count: number;
  session_ids: string[];
  avg_scores: { relevance: number; specificity: number; honesty: number; tone_fit: number };
  verdict_counts: Record<OverallVerdict | "unset", number>;
  annotation_stats_by_issue: AnnotationStatsByIssue;
  pattern_flags: PatternFlagAggregate[];
  avg_section_edit_fraction: SectionEditStats;
};

export type SessionSummary = {
  id: string;
  updated_at: string;
  scores: ApplicationSession["critique"]["scores"];
  verdict: OverallVerdict | null;
  pattern_flag_count: number;
  section_edit_fractions: SectionEditStats;
};

const ISSUE_DEFAULT = (): AnnotationStatsByIssue["good"] => ({
  total: 0,
  accepted: 0,
  rejected: 0,
  ignored: 0,
  no_response: 0,
});

function emptyIssueStats(): AnnotationStatsByIssue {
  const out: Partial<AnnotationStatsByIssue> = {};
  for (const issue of ANNOTATION_ISSUES) {
    out[issue] = ISSUE_DEFAULT();
  }
  return out as AnnotationStatsByIssue;
}

function sectionEdits(session: ApplicationSession): SectionEditStats {
  const opening = editFraction(
    session.letter_generated.opening,
    session.letter_edited.opening
  );
  const gap = editFraction(
    session.letter_generated.gap_acknowledgement ?? "",
    session.letter_edited.gap_acknowledgement ?? ""
  );
  const closing = editFraction(
    session.letter_generated.closing,
    session.letter_edited.closing
  );
  const bridgeFracs: number[] = [];
  const editedBridge = session.letter_edited.bridge;
  for (let i = 0; i < session.letter_generated.bridge.length; i += 1) {
    const orig = session.letter_generated.bridge[i]?.text ?? "";
    const edit = editedBridge[i]?.text ?? "";
    bridgeFracs.push(editFraction(orig, edit));
  }
  const bridgeAvg =
    bridgeFracs.length === 0
      ? 0
      : bridgeFracs.reduce((a, b) => a + b, 0) / bridgeFracs.length;
  return {
    opening,
    gap_acknowledgement: gap,
    closing,
    bridge_avg: bridgeAvg,
  };
}

function normalizeFlag(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function summarizeSessions(sessions: ApplicationSession[]): {
  stats: AggregateStats;
  per_session: SessionSummary[];
} {
  const issueStats = emptyIssueStats();
  const verdictCounts: AggregateStats["verdict_counts"] = {
    worked: 0,
    felt_off: 0,
    unset: 0,
  };
  const flagMap = new Map<string, PatternFlagAggregate>();

  let scoreSum = { relevance: 0, specificity: 0, honesty: 0, tone_fit: 0 };
  const sectionEditTotals: SectionEditStats = {
    opening: 0,
    gap_acknowledgement: 0,
    closing: 0,
    bridge_avg: 0,
  };
  const perSession: SessionSummary[] = [];

  for (const s of sessions) {
    scoreSum = {
      relevance: scoreSum.relevance + s.critique.scores.relevance,
      specificity: scoreSum.specificity + s.critique.scores.specificity,
      honesty: scoreSum.honesty + s.critique.scores.honesty,
      tone_fit: scoreSum.tone_fit + s.critique.scores.tone_fit,
    };

    if (s.feedback.overall_verdict) {
      verdictCounts[s.feedback.overall_verdict] += 1;
    } else {
      verdictCounts.unset += 1;
    }

    const responseByText = new Map<string, string>();
    for (const r of s.feedback.annotation_responses) {
      responseByText.set(`${r.annotation_section}::${r.annotation_target_text}`, r.response);
    }

    for (const ann of s.critique.annotations) {
      const bucket = issueStats[ann.issue];
      bucket.total += 1;
      const key = `${ann.target_section}::${ann.target_text}`;
      const resp = responseByText.get(key);
      if (resp === "accept") bucket.accepted += 1;
      else if (resp === "reject") bucket.rejected += 1;
      else if (resp === "ignore") bucket.ignored += 1;
      else bucket.no_response += 1;
    }

    for (const flag of s.feedback.pattern_flags) {
      const norm = normalizeFlag(flag);
      if (!norm) continue;
      const existing = flagMap.get(norm);
      if (existing) {
        existing.count += 1;
        existing.session_ids.push(s.id);
      } else {
        flagMap.set(norm, { text: flag.trim(), count: 1, session_ids: [s.id] });
      }
    }

    const edits = sectionEdits(s);
    sectionEditTotals.opening += edits.opening;
    sectionEditTotals.gap_acknowledgement += edits.gap_acknowledgement;
    sectionEditTotals.closing += edits.closing;
    sectionEditTotals.bridge_avg += edits.bridge_avg;

    perSession.push({
      id: s.id,
      updated_at: s.updated_at,
      scores: s.critique.scores,
      verdict: s.feedback.overall_verdict,
      pattern_flag_count: s.feedback.pattern_flags.length,
      section_edit_fractions: edits,
    });
  }

  const n = Math.max(1, sessions.length);
  const stats: AggregateStats = {
    session_count: sessions.length,
    session_ids: sessions.map((s) => s.id),
    avg_scores: {
      relevance: scoreSum.relevance / n,
      specificity: scoreSum.specificity / n,
      honesty: scoreSum.honesty / n,
      tone_fit: scoreSum.tone_fit / n,
    },
    verdict_counts: verdictCounts,
    annotation_stats_by_issue: issueStats,
    pattern_flags: [...flagMap.values()].sort((a, b) => b.count - a.count),
    avg_section_edit_fraction: {
      opening: sectionEditTotals.opening / n,
      gap_acknowledgement: sectionEditTotals.gap_acknowledgement / n,
      closing: sectionEditTotals.closing / n,
      bridge_avg: sectionEditTotals.bridge_avg / n,
    },
  };

  return { stats, per_session: perSession };
}

function stableId(seed: string): string {
  return "agg-" + createHash("sha1").update(seed).digest("hex").slice(0, 10);
}

const HIGH_REJECT_THRESHOLD = 0.6;
const HIGH_EDIT_THRESHOLD = 0.5;
const MIN_OBS_FOR_REJECT_RULE = 3;
const MIN_PATTERN_FLAG_REPEATS = 2;

export function deriveAggregatorProposals(
  sessions: ApplicationSession[],
  stats: AggregateStats
): LearningProposal[] {
  const proposals: LearningProposal[] = [];

  // 1. Repeated pattern flags → promote
  for (const flag of stats.pattern_flags) {
    if (flag.count < MIN_PATTERN_FLAG_REPEATS) continue;
    proposals.push({
      id: stableId(`flag::${normalizeFlag(flag.text)}`),
      observation: flag.text,
      rationale: `Flagged in ${flag.count} sessions — consistent enough to promote into the master profile.`,
      evidence_session_ids: flag.session_ids,
      source: "aggregator",
    });
  }

  // 2. Over-zealous critic on a particular issue type (high rejection rate)
  for (const [issue, s] of Object.entries(stats.annotation_stats_by_issue) as [
    AnnotationIssue,
    AnnotationStatsByIssue[AnnotationIssue],
  ][]) {
    if (s.total < MIN_OBS_FOR_REJECT_RULE) continue;
    const rate = s.rejected / s.total;
    if (rate >= HIGH_REJECT_THRESHOLD) {
      proposals.push({
        id: stableId(`reject::${issue}`),
        observation: `Critic is over-zealous on '${issue}' annotations — verify before applying suggested rewrites.`,
        rationale: `${s.rejected}/${s.total} annotations of this type were explicitly rejected.`,
        evidence_session_ids: stats.session_ids,
        source: "aggregator",
      });
    }
  }

  // 3. Sections that get rewritten heavily → generator may be off-key for them
  const editStats = stats.avg_section_edit_fraction;
  const sectionLabels: { key: keyof SectionEditStats; label: string }[] = [
    { key: "opening", label: "opening" },
    { key: "bridge_avg", label: "bridge paragraphs" },
    { key: "gap_acknowledgement", label: "gap acknowledgement" },
    { key: "closing", label: "closing" },
  ];
  if (sessions.length >= 2) {
    for (const { key, label } of sectionLabels) {
      if (editStats[key] >= HIGH_EDIT_THRESHOLD) {
        proposals.push({
          id: stableId(`section::${key}`),
          observation: `Generator drafts of the '${label}' section need heavy rewriting — tighten the corresponding prompt or add a tone rule.`,
          rationale: `Average edit fraction across ${sessions.length} sessions: ${(editStats[key] * 100).toFixed(0)}%.`,
          evidence_session_ids: stats.session_ids,
          source: "aggregator",
        });
      }
    }
  }

  return proposals;
}

export function stableProposalId(source: "aggregator" | "llm", observation: string): string {
  return (
    (source === "aggregator" ? "agg-" : "llm-") +
    createHash("sha1").update(observation.toLowerCase().trim()).digest("hex").slice(0, 10)
  );
}
