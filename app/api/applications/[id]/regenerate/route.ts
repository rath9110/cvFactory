import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { loadSession } from "@/lib/applications";
import { loadProfile } from "@/lib/load-profile";
import { analyzeJobAd } from "@/lib/analyzer";
import { generateCoverLetter } from "@/lib/cover-generator";
import { critiqueCoverLetter } from "@/lib/critique";
import { generateCVVariant } from "@/lib/cv-generator";
import { critiqueCVVariant } from "@/lib/cv-critique";

export const runtime = "nodejs";

function profileSignature(profile: {
  learned_preferences: { observation: string }[];
  tone_rules: { rule: string }[];
}): string {
  const seed = JSON.stringify({
    lp: profile.learned_preferences.map((p) => p.observation).sort(),
    tr: profile.tone_rules.map((r) => r.rule).sort(),
  });
  return "sig-" + createHash("sha1").update(seed).digest("hex").slice(0, 10);
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let session;
  try {
    session = await loadSession(id);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (err instanceof Error && err.message === "Invalid application id") {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load session" },
      { status: 500 }
    );
  }

  const profile = await loadProfile();

  const { brief, mocked: briefMocked } = await analyzeJobAd(profile, session.job_ad);

  const { letter, mocked: letterMocked } = await generateCoverLetter(
    profile,
    brief,
    session.job_ad
  );

  const { critique, mocked: critiqueMocked } = await critiqueCoverLetter(
    profile,
    brief,
    letter
  );

  const { variant: cvVariant, mocked: cvMocked } = await generateCVVariant(profile, brief);
  const { critique: cvCritique, mocked: cvCritiqueMocked } = await critiqueCVVariant(
    profile,
    brief,
    cvVariant
  );

  return NextResponse.json({
    brief,
    letter,
    critique,
    cv_variant: cvVariant,
    cv_critique: cvCritique,
    profile_signature: profileSignature(profile),
    learned_preferences_count: profile.learned_preferences.length,
    mocked:
      briefMocked || letterMocked || critiqueMocked || cvMocked || cvCritiqueMocked,
  });
}
