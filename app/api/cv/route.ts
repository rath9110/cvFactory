import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile } from "@/lib/load-profile";
import { generateCVVariant } from "@/lib/cv-generator";
import { critiqueCVVariant } from "@/lib/cv-critique";
import { StrategicBriefSchema } from "@/lib/profile-types";

export const runtime = "nodejs";

const BodySchema = z.object({
  brief: StrategicBriefSchema,
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

  const { variant, mocked: variantMocked } = await generateCVVariant(
    profile,
    parsed.data.brief
  );

  const { critique, mocked: critiqueMocked } = await critiqueCVVariant(
    profile,
    parsed.data.brief,
    variant
  );

  return NextResponse.json({
    variant,
    critique,
    mocked: variantMocked || critiqueMocked,
    profile_snapshot: {
      name: profile.name,
      contact: profile.contact,
      experience_blocks: profile.experience_blocks,
      education: profile.education,
      certifications: profile.certifications,
      languages: profile.languages,
    },
  });
}
