import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile, saveProfile } from "@/lib/load-profile";

export const runtime = "nodejs";

const BodySchema = z.object({
  learning_id: z.string().min(1),
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
        error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
      { status: 400 }
    );
  }

  const profile = await loadProfile();
  const before = profile.learned_preferences.length;
  profile.learned_preferences = profile.learned_preferences.filter(
    (p) => p.id !== parsed.data.learning_id
  );
  const after = profile.learned_preferences.length;

  if (before === after) {
    return NextResponse.json(
      { error: "No learning with that id" },
      { status: 404 }
    );
  }

  await saveProfile(profile);
  return NextResponse.json({
    reverted_id: parsed.data.learning_id,
    remaining_count: after,
  });
}
