"use client";

import { useMemo, useState } from "react";
import { analyzeHumanity, type TellFinding } from "@/lib/ai-tells";

/**
 * Shows whether the current draft reads as machine-written.
 *
 * Runs entirely in the browser on the text as currently edited — no server call,
 * no model call, no cost — so it updates live while the draft is being edited.
 */
export default function HumanityPanel({
  segments,
  kind,
}: {
  segments: string[];
  kind: "cv" | "letter";
}) {
  const [open, setOpen] = useState(true);
  const report = useMemo(
    () => analyzeHumanity({ segments, kind }),
    [segments, kind]
  );

  if (report.metrics.word_count === 0) return null;

  const tone =
    report.band === "reads human"
      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
      : report.band === "a few tells"
        ? "border-amber-300 bg-amber-50 text-amber-900"
        : "border-rose-300 bg-rose-50 text-rose-900";

  // Per-line findings are shown as comments on the line itself. What is left
  // here is the whole-CV view: the score, and the rules that are about the
  // document rather than any one bullet.
  const documentLevel = report.findings.filter((f) => f.segment_index < 0);
  const inlineCount = report.findings.length - documentLevel.length;
  const strong = documentLevel.filter((f) => f.severity === "strong");
  const weak = documentLevel.filter((f) => f.severity === "weak");

  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Does this read as human?
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            Checked in your browser against known markers of generated text. No AI
            involved, nothing sent anywhere.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`rounded-md border px-3 py-1.5 text-sm font-medium ${tone}`}>
            {report.score}/100 · {report.band}
          </span>
          {documentLevel.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="text-xs font-medium text-stone-600 underline underline-offset-4"
            >
              {open ? "Hide" : `Show ${documentLevel.length}`}
            </button>
          )}
        </div>
      </div>

      {report.findings.length === 0 && (
        <p className="mt-3 text-sm text-stone-700">
          No tells found. Concrete, specific, and free of stock phrasing.
        </p>
      )}

      {inlineCount > 0 && (
        <p className="mt-3 text-sm text-stone-700">
          {inlineCount} {inlineCount === 1 ? "comment is" : "comments are"} attached to
          the lines below, each with the fix ready to apply.
        </p>
      )}

      {open && documentLevel.length > 0 && (
        <div className="mt-4 space-y-4">
          {strong.length > 0 && (
            <FindingGroup
              title={`Whole CV, worth fixing (${strong.length})`}
              findings={strong}
              className="border-rose-200 bg-rose-50"
            />
          )}
          {weak.length > 0 && (
            <FindingGroup
              title={`Whole CV, minor (${weak.length})`}
              findings={weak}
              className="border-amber-200 bg-amber-50"
            />
          )}
          <p className="text-xs text-stone-500">
            The score is a rough index — {strong.length} major and {weak.length} minor
            findings. The findings themselves are the useful part; a judgement call
            that a phrase belongs is a perfectly good reason to leave it.
          </p>
        </div>
      )}
    </div>
  );
}

function FindingGroup({
  title,
  findings,
  className,
}: {
  title: string;
  findings: TellFinding[];
  className: string;
}) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h4>
      <ul className="space-y-2">
        {findings.map((f, i) => (
          <li key={`${f.rule_id}-${f.segment_index}-${i}`} className={`rounded-md border p-3 ${className}`}>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">{f.label}</span>
              {f.segment_index >= 0 && (
                <span className="text-xs opacity-70">
                  {f.segment_index === 0 ? "summary" : `entry ${f.segment_index}`}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm italic opacity-90">&ldquo;{f.excerpt}&rdquo;</p>
            <p className="mt-1 text-sm">{f.why}</p>
            {f.suggestion && (
              <p className="mt-1 text-xs font-medium opacity-80">→ {f.suggestion}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
