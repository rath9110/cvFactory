import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CoverLetterSchema,
  CritiqueSchema,
  FeedbackBlockSchema,
  StrategicBriefSchema,
} from "@/lib/profile-types";
import { newApplicationId, saveSession } from "@/lib/applications";

export const runtime = "nodejs";

const BodySchema = z.object({
  id: z.string().optional(),
  job_ad: z.string().min(1),
  brief: StrategicBriefSchema,
  letter_generated: CoverLetterSchema,
  letter_edited: CoverLetterSchema,
  critique: CritiqueSchema,
  feedback: FeedbackBlockSchema,
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
      {
        error: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const id = parsed.data.id ?? newApplicationId();

  const session = {
    id,
    created_at: now,
    updated_at: now,
    job_ad: parsed.data.job_ad,
    brief: parsed.data.brief,
    letter_generated: parsed.data.letter_generated,
    letter_edited: parsed.data.letter_edited,
    critique: parsed.data.critique,
    feedback: parsed.data.feedback,
  };

  try {
    await saveSession(session);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save" },
      { status: 500 }
    );
  }

  return NextResponse.json({ id, updated_at: now });
}
