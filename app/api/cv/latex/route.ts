import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile } from "@/lib/load-profile";
import { renderLatex } from "@/lib/latex-template";
import { CVVariantSchema } from "@/lib/profile-types";

export const runtime = "nodejs";

const BodySchema = z.object({
  variant: CVVariantSchema,
  filename: z
    .string()
    .regex(/^[\w.-]{1,80}$/, "filename must be filesystem-safe")
    .optional(),
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
  const tex = renderLatex(parsed.data.variant, profile);
  const filename = parsed.data.filename ?? "cv.tex";

  return new NextResponse(tex, {
    status: 200,
    headers: {
      "content-type": "application/x-tex; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
