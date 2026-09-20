import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadProfile } from "@/lib/load-profile";
import { CoverLetterSchema, CVVariantSchema } from "@/lib/profile-types";
import {
  printDocument,
  renderCVBody,
  renderCoverLetterBody,
  wordDocument,
} from "@/lib/export-document";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    // "doc" downloads a Word-openable file; "print" returns a page whose print
    // dialog produces the PDF.
    format: z.enum(["doc", "print"]),
    filename: z
      .string()
      .regex(/^[\w.-]{1,80}$/, "filename must be filesystem-safe")
      .optional(),
    letter: CoverLetterSchema.optional(),
    variant: CVVariantSchema.optional(),
  })
  .refine((b) => Boolean(b.letter) !== Boolean(b.variant), {
    message: "Provide exactly one of letter or variant",
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

  const profile = await loadProfile();
  const { format, letter, variant } = parsed.data;

  const title = letter
    ? `${profile.name} — Cover letter`
    : `${profile.name} — CV`;
  const documentBody = letter
    ? renderCoverLetterBody(letter, profile)
    : renderCVBody(variant!, profile);

  if (format === "print") {
    return new NextResponse(printDocument(title, documentBody), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const filename =
    parsed.data.filename ?? (letter ? "cover-letter.doc" : "cv.doc");

  return new NextResponse(wordDocument(title, documentBody), {
    status: 200,
    headers: {
      "content-type": "application/msword; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  });
}
