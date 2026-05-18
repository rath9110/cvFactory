import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile } from "@/lib/load-profile";
import { analyzeJobAd } from "@/lib/analyzer";

export const runtime = "nodejs";

const BodySchema = z.object({
  jobAd: z.string().min(20, "Job ad text must be at least 20 characters"),
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
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const profile = await loadProfile();
  const { brief, mocked } = await analyzeJobAd(profile, parsed.data.jobAd);

  return NextResponse.json({ brief, mocked, profileName: profile.name });
}
