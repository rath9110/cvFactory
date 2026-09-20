import { NextResponse } from "next/server";
import {
  collectLearningInputs,
  refreshLearning,
  withoutAccepted,
} from "@/lib/learning-cache";

export const runtime = "nodejs";

/**
 * Recomputes the learning proposals — the one model call in the app that no one
 * explicitly asked for, so it is deliberately hard to trigger twice.
 *
 * Fired by the client when work is finished rather than when the page is opened:
 * on download, on save, and on the tab closing, whichever comes first. Any of
 * those may fire repeatedly; the signature check makes every call after the
 * first one free until the sessions or the profile actually change.
 */
export async function POST() {
  const inputs = await collectLearningInputs();

  if (inputs.sessions.length === 0) {
    return NextResponse.json({ recomputed: false, reason: "no sessions yet" });
  }

  try {
    const { cache, recomputed } = await refreshLearning(inputs);
    return NextResponse.json({
      recomputed,
      generated_at: cache.generated_at,
      mocked: cache.mocked,
      proposals: withoutAccepted(cache.proposals, inputs.existingObservations),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refresh failed" },
      { status: 500 }
    );
  }
}
