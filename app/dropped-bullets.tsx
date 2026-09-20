"use client";

import { useMemo, useState } from "react";
import { jaccardSimilarity } from "@/lib/diff";
import { sourceBullets } from "@/lib/profile-context";
import type { ExperienceBlock } from "@/lib/profile-types";

/** Above this overlap, a source bullet is considered present in the draft. */
const PRESENT_THRESHOLD = 0.5;

/**
 * The bullets the generator left out of this role, with a way to put them back.
 *
 * Selection is the generator's main lever now, which means the interesting
 * editorial decision — what got cut — was previously invisible. Matching is by
 * overlap rather than exact text so a bullet stays "present" after it has been
 * reworded or hand-edited.
 */
export default function DroppedBullets({
  block,
  current,
  onAdd,
}: {
  block: ExperienceBlock;
  /** The bullets currently in the editor for this block. */
  current: string[];
  onAdd: (bullet: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const dropped = useMemo(() => {
    const kept = current.filter((b) => b.trim().length > 0);
    return sourceBullets(block).filter(
      (source) => !kept.some((b) => jaccardSimilarity(b, source) >= PRESENT_THRESHOLD)
    );
  }, [block, current]);

  if (dropped.length === 0) return null;

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-xs font-medium text-stone-600 underline-offset-4 hover:text-stone-900 hover:underline"
      >
        {dropped.length} {dropped.length === 1 ? "bullet" : "bullets"} left out of this
        role {open ? "▾" : "▸"}
      </button>

      {open && (
        <ul className="mt-2 space-y-1.5">
          {dropped.map((bullet, i) => (
            <li key={i} className="flex items-start gap-2 text-xs">
              <button
                type="button"
                onClick={() => onAdd(bullet)}
                className="mt-0.5 shrink-0 rounded border border-stone-300 bg-white px-1.5 py-0.5 font-medium hover:bg-stone-100"
                aria-label="Add this bullet back"
              >
                + Add
              </button>
              <span className="leading-relaxed text-stone-700">{bullet}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
