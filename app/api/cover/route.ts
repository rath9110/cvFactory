import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile } from "@/lib/load-profile";
import { generateCoverLetter } from "@/lib/cover-generator";
import { critiqueCoverLetter } from "@/lib/critique";
import { StrategicBriefSchema } from "@/lib/profile-types";

export const runtime = "nodejs";

const BodySchema = z.object({
  jobAd: z.string().min(20),
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

  const { letter, mocked: letterMocked } = await generateCoverLetter(
    profile,
    parsed.data.brief,
    parsed.data.jobAd
  );

  const { critique, mocked: critiqueMocked } = await critiqueCoverLetter(
    profile,
    parsed.data.brief,
    letter
  );

  return NextResponse.json({
    letter,
    critique,
    mocked: letterMocked || critiqueMocked,
  });
}
