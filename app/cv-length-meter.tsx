"use client";

import { useMemo } from "react";
import { estimateCvLength, lengthVerdict } from "@/lib/cv-length";
import type { CVVariant, Education, Certification, ExperienceBlock } from "@/lib/profile-types";

const TONE: Record<"good" | "warn" | "bad", string> = {
  good: "border-emerald-300 bg-emerald-50 text-emerald-900",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  bad: "border-rose-300 bg-rose-50 text-rose-900",
};

/**
 * How long this CV will actually be once rendered, and where to cut if it is
 * too long. Recomputed from the edited variant as you type — no model, no cost.
 */
export default function CvLengthMeter({
  variant,
  profile,
}: {
  variant: CVVariant;
  profile: {
    experience_blocks: ExperienceBlock[];
    education: Education[];
    certifications: Certification[];
    languages: string[];
  };
}) {
  const estimate = useMemo(
    () => estimateCvLength(variant, profile),
    [variant, profile]
  );
  const verdict = lengthVerdict(estimate.pages);
  const bulletCount = variant.experience.reduce((n, e) => n + e.bullets.length, 0);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <span className={`rounded-md border px-3 py-1.5 text-sm font-medium ${TONE[verdict.tone]}`}>
        ≈ {estimate.pages} {estimate.pages === 1 ? "page" : "pages"} · {verdict.label}
      </span>
      <span className="text-xs text-stone-500">
        {bulletCount} bullets across {estimate.blocks.length} roles.
        {verdict.tone !== "good" && estimate.longest && (
          <>
            {" "}
            Longest is <strong className="font-medium">{estimate.longest.role}</strong> at{" "}
            {estimate.longest.bullet_count} bullets — the first place to cut.
          </>
        )}
      </span>
    </div>
  );
}
