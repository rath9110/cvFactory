import { NextResponse } from "next/server";
import { summarizeSessions } from "@/lib/learn-aggregator";
import {
  collectLearningInputs,
  readLearningCache,
  withoutAccepted,
} from "@/lib/learning-cache";

export const runtime = "nodejs";

/**
 * Reading the learning page is free: deterministic stats are computed here, and
 * proposals come from whatever the last refresh stored. This route never calls
 * the model — see POST /api/learn/refresh.
 */
export async function GET() {
  const inputs = await collectLearningInputs();
  const { stats, per_session } = summarizeSessions(inputs.sessions);
  const cache = await readLearningCache();

  return NextResponse.json({
    stats,
    per_session,
    proposals: cache ? withoutAccepted(cache.proposals, inputs.existingObservations) : [],
    mocked: cache?.mocked ?? false,
    accepted_count: inputs.acceptedCount,
    skipped_session_ids: inputs.skippedSessionIds,
    // The UI uses these to say whether what it is showing is current.
    generated_at: cache?.generated_at ?? null,
    stale: !cache || cache.signature !== inputs.signature,
  });
}
