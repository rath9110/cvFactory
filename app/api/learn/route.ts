import { NextResponse } from "next/server";
import { listSessions, loadSession } from "@/lib/applications";
import {
  deriveAggregatorProposals,
  summarizeSessions,
} from "@/lib/learn-aggregator";
import { detectPatterns } from "@/lib/pattern-detector";
import { loadProfile } from "@/lib/load-profile";
import type { ApplicationSession } from "@/lib/profile-types";

export const runtime = "nodejs";

export async function GET() {
  const summaries = await listSessions();
  // A session that fails to parse (hand-edited, or written before a schema change)
  // must not take the whole learning page down with it.
  const loaded = await Promise.all(
    summaries.map(async (s) => {
      try {
        return await loadSession(s.id);
      } catch {
        return null;
      }
    })
  );
  const sessions = loaded.filter(
    (s): s is ApplicationSession => s !== null
  );
  const skippedSessionIds = summaries
    .filter((_, i) => loaded[i] === null)
    .map((s) => s.id);
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
    skipped_session_ids: skippedSessionIds,
  });
}
