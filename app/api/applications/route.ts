import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CoverLetterSchema,
  CritiqueSchema,
  CVCritiqueSchema,
  CVVariantSchema,
  FeedbackBlockSchema,
  StrategicBriefSchema,
} from "@/lib/profile-types";
import {
  listSessions,
  loadSession,
  newApplicationId,
  saveSession,
} from "@/lib/applications";

export const runtime = "nodejs";

export async function GET() {
  const summaries = await listSessions();
  const detailed = await Promise.all(
    summaries.map(async (s) => {
      try {
        const session = await loadSession(s.id);
        const jobSnippet = session.job_ad.slice(0, 120);
        return {
          id: session.id,
          created_at: session.created_at,
          updated_at: session.updated_at,
          job_snippet: jobSnippet,
          verdict: session.feedback.overall_verdict,
          scores: session.critique.scores,
          has_cv: Boolean(session.cv_variant),
        };
      } catch {
        return null;
      }
    })
  );
  return NextResponse.json({
    sessions: detailed.filter((d): d is NonNullable<typeof d> => d !== null),
  });
}

const BodySchema = z.object({
  id: z.string().optional(),
  job_ad: z.string().min(1),
  brief: StrategicBriefSchema,
  letter_generated: CoverLetterSchema,
  letter_edited: CoverLetterSchema,
  critique: CritiqueSchema,
  feedback: FeedbackBlockSchema,
  cv_variant: CVVariantSchema.optional(),
  cv_critique: CVCritiqueSchema.optional(),
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
    ...(parsed.data.cv_variant && { cv_variant: parsed.data.cv_variant }),
    ...(parsed.data.cv_critique && { cv_critique: parsed.data.cv_critique }),
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
