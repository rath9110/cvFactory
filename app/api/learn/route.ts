import { NextResponse } from "next/server";
import { listSessions, loadSession } from "@/lib/applications";
import {
  deriveAggregatorProposals,
  summarizeSessions,
} from "@/lib/learn-aggregator";
import { detectPatterns } from "@/lib/pattern-detector";
import { loadProfile } from "@/lib/load-profile";

export const runtime = "nodejs";

export async function GET() {
  const summaries = await listSessions();
  const sessions = await Promise.all(summaries.map((s) => loadSession(s.id)));
  const { stats, per_session } = summarizeSessions(sessions);
  const aggregatorProposals = deriveAggregatorProposals(sessions, stats);
  const { proposals: llmProposals, mocked } = await detectPatterns(
    sessions,
    stats,
    aggregatorProposals
  );

  const profile = await loadProfile();
  const existingObservations = new Set(
    profile.learned_preferences.map((p) => p.observation.toLowerCase().trim())
  );
  const allProposals = [...aggregatorProposals, ...llmProposals].filter(
    (p) => !existingObservations.has(p.observation.toLowerCase().trim())
  );

  return NextResponse.json({
    stats,
    per_session,
    proposals: allProposals,
    mocked,
    accepted_count: profile.learned_preferences.length,
  });
}
