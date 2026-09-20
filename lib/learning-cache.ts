import { createHash } from "crypto";
import { listSessions, loadSession } from "./applications";
import { loadProfile } from "./load-profile";
import { storage } from "./storage";
import { deriveAggregatorProposals, summarizeSessions } from "./learn-aggregator";
import { detectPatterns } from "./pattern-detector";
import type { ApplicationSession, LearningCache, LearningProposal } from "./profile-types";

/**
 * The learning pass is the one place in the app that calls the model without a
 * user pressing "generate", so it is the one place that can quietly run up a
 * bill. Two rules keep that in check:
 *
 *   - Reading the page never calls the model. `GET /api/learn` returns the free
 *     deterministic stats plus whatever proposals were last computed.
 *   - A refresh only calls the model when the underlying state has actually
 *     changed, which is what the signature below decides. The check lives here,
 *     on the server, so a browser firing the trigger three times still costs one
 *     call at most.
 */

export type LearningInputs = {
  sessions: ApplicationSession[];
  skippedSessionIds: string[];
  signature: string;
  existingObservations: Set<string>;
  acceptedCount: number;
};

/** Everything the proposals depend on: the sessions, and the profile's learnings. */
function signatureOf(
  summaries: Array<{ id: string; updated_at: string }>,
  learnedObservations: string[]
): string {
  const seed = JSON.stringify({
    s: [...summaries].map((s) => `${s.id}:${s.updated_at}`).sort(),
    l: [...learnedObservations].sort(),
  });
  return createHash("sha1").update(seed).digest("hex").slice(0, 16);
}

export async function collectLearningInputs(): Promise<LearningInputs> {
  const summaries = await listSessions();
  // A session that fails to parse must not take the whole page down with it.
  const loaded = await Promise.all(
    summaries.map(async (s) => {
      try {
        return await loadSession(s.id);
      } catch {
        return null;
      }
    })
  );
  const sessions = loaded.filter((s): s is ApplicationSession => s !== null);
  const skippedSessionIds = summaries
    .filter((_, i) => loaded[i] === null)
    .map((s) => s.id);

  const profile = await loadProfile();
  const observations = profile.learned_preferences.map((p) => p.observation);

  return {
    sessions,
    skippedSessionIds,
    signature: signatureOf(summaries, observations),
    existingObservations: new Set(observations.map((o) => o.toLowerCase().trim())),
    acceptedCount: profile.learned_preferences.length,
  };
}

/** Proposals already accepted into the profile are not proposed again. */
export function withoutAccepted(
  proposals: LearningProposal[],
  existingObservations: Set<string>
): LearningProposal[] {
  return proposals.filter(
    (p) => !existingObservations.has(p.observation.toLowerCase().trim())
  );
}

export async function readLearningCache(): Promise<LearningCache | null> {
  return storage().loadLearningCache();
}

/**
 * Recomputes proposals, but only if the signature moved. Returns the cache entry
 * either way, plus whether the model was actually called.
 */
export async function refreshLearning(
  inputs: LearningInputs
): Promise<{ cache: LearningCache; recomputed: boolean }> {
  const cached = await storage().loadLearningCache();
  if (cached && cached.signature === inputs.signature) {
    return { cache: cached, recomputed: false };
  }

  const { stats } = summarizeSessions(inputs.sessions);
  const aggregator = deriveAggregatorProposals(inputs.sessions, stats);
  const { proposals: llm, mocked } = await detectPatterns(
    inputs.sessions,
    stats,
    aggregator
  );

  const cache: LearningCache = {
    signature: inputs.signature,
    proposals: [...aggregator, ...llm],
    mocked,
    generated_at: new Date().toISOString(),
  };

  await storage().saveLearningCache(cache);
  return { cache, recomputed: true };
}
