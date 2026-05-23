import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile, saveProfile } from "@/lib/load-profile";
import { LearningProposalSchema } from "@/lib/profile-types";

export const runtime = "nodejs";

const BodySchema = z.object({
  proposal: LearningProposalSchema,
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") },
      { status: 400 }
    );
  }

  const profile = await loadProfile();
  const proposal = parsed.data.proposal;

  const existing = profile.learned_preferences.find(
    (p) => p.observation.toLowerCase().trim() === proposal.observation.toLowerCase().trim()
  );
  if (existing) {
    return NextResponse.json(
      { error: "Already accepted", existing_id: existing.id },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const id =
    "lp-" +
    now.replace(/[:.]/g, "-").replace("Z", "") +
    "-" +
    Math.random().toString(36).slice(2, 6);

  profile.learned_preferences.push({
    id,
    observation: proposal.observation,
    source_application_ids: proposal.evidence_session_ids,
    confidence: "confirmed",
    created_at: now,
  });

  await saveProfile(profile);

  return NextResponse.json({ id, accepted_count: profile.learned_preferences.length });
}
