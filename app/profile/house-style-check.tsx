"use client";

import { useMemo, useState } from "react";
import { analyzeHumanity } from "@/lib/ai-tells";
import { sourceBullets } from "@/lib/profile-context";
import type { MasterProfile } from "@/lib/profile-types";

/**
 * Runs the CV house-style rules over the master profile itself.
 *
 * This matters because the CV generator now *selects* bullets by index and
 * takes their text verbatim. It cannot fix a bullet that opens with
 * "Responsible for" or carries an em dash — it can only include it or leave it
 * out. Every violation here is a ceiling on every CV the system will ever
 * produce, so this is the highest-leverage place to edit.
 */
export default function HouseStyleCheck({ profile }: { profile: MasterProfile }) {
  const [open, setOpen] = useState(false);

  const { report, labelFor } = useMemo(() => {
    const segments = [profile.profile_summary];
    const labels = ["Profile summary"];
    for (const block of profile.experience_blocks) {
      for (const bullet of sourceBullets(block)) {
        segments.push(bullet);
        labels.push(block.role);
      }
    }
    return {
      report: analyzeHumanity({ segments, kind: "cv" }),
      labelFor: (i: number) => labels[i] ?? "",
    };
  }, [profile]);

  const perBullet = report.findings.filter((f) => f.segment_index >= 0);
  if (perBullet.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <strong>Your source bullets pass the house-style rules.</strong> Nothing in the
        profile is holding a generated CV back.
      </div>
    );
  }

  const byRule = new Map<string, typeof perBullet>();
  for (const f of perBullet) {
    byRule.set(f.rule_id, [...(byRule.get(f.rule_id) ?? []), f]);
  }
  const ranked = [...byRule.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            House style in your source material
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-stone-600">
            CV bullets are taken from here word for word, so the generator cannot fix
            these — it can only leave a bullet out. Editing{" "}
            <code>master_profile.json</code> raises the ceiling on every CV.
          </p>
        </div>
        <span className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900">
          {perBullet.length} to fix
        </span>
      </div>

      <ul className="mt-3 space-y-1 text-sm">
        {ranked.map(([ruleId, list]) => (
          <li key={ruleId} className="flex items-baseline gap-2">
            <span className="w-8 shrink-0 text-right tabular-nums font-medium">
              {list.length}
            </span>
            <span>{list[0].label}</span>
            <span className="text-xs text-stone-500">— {list[0].suggestion}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-3 text-xs font-medium text-stone-600 underline underline-offset-4 hover:text-stone-900"
      >
        {open ? "Hide the offending bullets" : "Show the offending bullets"}
      </button>

      {open && (
        <ul className="mt-3 space-y-2">
          {perBullet.map((f, i) => (
            <li
              key={`${f.rule_id}-${i}`}
              className="rounded-md border border-stone-200 bg-stone-50 p-2 text-xs"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{f.label}</span>
                <span className="text-stone-500">{labelFor(f.segment_index)}</span>
              </div>
              <p className="mt-1 italic text-stone-700">&ldquo;{f.excerpt}&rdquo;</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
