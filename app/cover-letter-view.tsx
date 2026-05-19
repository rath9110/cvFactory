"use client";

import { useMemo, useState } from "react";
import type {
  Annotation,
  AnnotationIssue,
  CoverLetter,
  Critique,
  StrategicBrief,
} from "@/lib/profile-types";

type CoverApiResponse = {
  letter: CoverLetter;
  critique: Critique;
  mocked: boolean;
};

type EditableLetter = {
  opening: string;
  bridge: string[];
  gap_acknowledgement: string;
  closing: string;
};

const ISSUE_STYLES: Record<AnnotationIssue, string> = {
  unsupported_claim: "border-rose-300 bg-rose-50 text-rose-900",
  generic_platitude: "border-amber-300 bg-amber-50 text-amber-900",
  drift_from_brief: "border-orange-300 bg-orange-50 text-orange-900",
  tone_mismatch: "border-purple-300 bg-purple-50 text-purple-900",
  voice_unnatural: "border-sky-300 bg-sky-50 text-sky-900",
  good: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

const ISSUE_LABEL: Record<AnnotationIssue, string> = {
  unsupported_claim: "Unsupported claim",
  generic_platitude: "Generic",
  drift_from_brief: "Drift from brief",
  tone_mismatch: "Tone mismatch",
  voice_unnatural: "Voice off",
  good: "Strength",
};

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = (score / 10) * 100;
  const color =
    score >= 8 ? "bg-emerald-500" : score >= 6 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium text-stone-700">{label}</span>
        <span className="tabular-nums text-stone-500">{score}/10</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-stone-200">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function AnnotationCard({
  ann,
  onApply,
}: {
  ann: Annotation;
  onApply?: (rewrite: string) => void;
}) {
  return (
    <div className={`rounded-md border p-3 text-sm ${ISSUE_STYLES[ann.issue]}`}>
      <div className="mb-1 flex items-center gap-2">
        <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium">
          {ISSUE_LABEL[ann.issue]}
        </span>
        <code className="truncate text-xs opacity-80">"{ann.target_text}"</code>
      </div>
      <p className="text-sm">{ann.note}</p>
      {ann.suggested_rewrite && (
        <div className="mt-2 space-y-1">
          <div className="text-xs font-medium uppercase tracking-wide opacity-70">
            Suggested rewrite
          </div>
          <div className="rounded border border-white/60 bg-white/70 p-2 text-sm">
            {ann.suggested_rewrite}
          </div>
          {onApply && (
            <button
              type="button"
              onClick={() => onApply(ann.suggested_rewrite!)}
              className="text-xs font-medium underline underline-offset-2"
            >
              Apply rewrite
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CoverLetterView({
  jobAd,
  brief,
}: {
  jobAd: string;
  brief: StrategicBrief;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverApiResponse | null>(null);
  const [edited, setEdited] = useState<EditableLetter | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setEdited(null);
    try {
      const res = await fetch("/api/cover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobAd, brief }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        const r = data as CoverApiResponse;
        setResult(r);
        setEdited({
          opening: r.letter.opening,
          bridge: r.letter.bridge.map((b) => b.text),
          gap_acknowledgement: r.letter.gap_acknowledgement ?? "",
          closing: r.letter.closing,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const annotationsBySection = useMemo(() => {
    if (!result) return {} as Record<string, Annotation[]>;
    const grouped: Record<string, Annotation[]> = {
      opening: [],
      bridge: [],
      gap_acknowledgement: [],
      closing: [],
    };
    for (const ann of result.critique.annotations) {
      grouped[ann.target_section]?.push(ann);
    }
    return grouped;
  }, [result]);

  function applyRewriteTo(
    section: "opening" | "closing" | "gap_acknowledgement",
    targetText: string,
    rewrite: string
  ) {
    if (!edited) return;
    const next = { ...edited };
    const current = next[section];
    next[section] = current.includes(targetText)
      ? current.replace(targetText, rewrite)
      : rewrite;
    setEdited(next);
  }

  function applyRewriteToBridge(idx: number, targetText: string, rewrite: string) {
    if (!edited) return;
    const next = { ...edited, bridge: [...edited.bridge] };
    const current = next.bridge[idx];
    next.bridge[idx] = current.includes(targetText)
      ? current.replace(targetText, rewrite)
      : rewrite;
    setEdited(next);
  }

  function fullLetterText(): string {
    if (!edited) return "";
    return [
      edited.opening,
      "",
      ...edited.bridge.flatMap((p) => [p, ""]),
      ...(edited.gap_acknowledgement.trim()
        ? [edited.gap_acknowledgement, ""]
        : []),
      edited.closing,
      "",
      result?.letter.signoff ?? `Best regards,\nRasmus Thunberg`,
    ].join("\n");
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(fullLetterText());
    } catch {
      // ignore
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Cover letter</h2>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {loading
            ? "Generating + critiquing…"
            : result
              ? "Regenerate"
              : "Generate cover letter"}
        </button>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}

      {result && edited && (
        <div className="space-y-6">
          {result.mocked && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Mock output.</strong> Set <code>ANTHROPIC_API_KEY</code> in
              <code> .env.local</code> for real generation + critique.
            </div>
          )}

          <div className="grid gap-4 rounded-lg border border-stone-200 bg-white p-4 shadow-sm md:grid-cols-4">
            <ScoreBar label="Relevance" score={result.critique.scores.relevance} />
            <ScoreBar label="Specificity" score={result.critique.scores.specificity} />
            <ScoreBar label="Honesty" score={result.critique.scores.honesty} />
            <ScoreBar label="Tone fit" score={result.critique.scores.tone_fit} />
          </div>

          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Verdict
            </h3>
            <p className="text-sm leading-relaxed">{result.critique.verdict}</p>
          </div>

          <SectionEditor
            label="Opening"
            value={edited.opening}
            onChange={(v) => setEdited({ ...edited, opening: v })}
            annotations={annotationsBySection.opening ?? []}
            onApplyRewrite={(text, rewrite) =>
              applyRewriteTo("opening", text, rewrite)
            }
          />

          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Bridge
            </h3>
            {edited.bridge.map((para, i) => (
              <SectionEditor
                key={i}
                label={`Bridge paragraph ${i + 1}`}
                value={para}
                onChange={(v) => {
                  const next = { ...edited, bridge: [...edited.bridge] };
                  next.bridge[i] = v;
                  setEdited(next);
                }}
                annotations={
                  i === 0 ? annotationsBySection.bridge ?? [] : []
                }
                onApplyRewrite={(text, rewrite) =>
                  applyRewriteToBridge(i, text, rewrite)
                }
                proofRefs={result.letter.bridge[i]?.proof_point_ids ?? []}
              />
            ))}
          </div>

          <SectionEditor
            label="Gap acknowledgement (optional)"
            value={edited.gap_acknowledgement}
            onChange={(v) => setEdited({ ...edited, gap_acknowledgement: v })}
            annotations={annotationsBySection.gap_acknowledgement ?? []}
            onApplyRewrite={(text, rewrite) =>
              applyRewriteTo("gap_acknowledgement", text, rewrite)
            }
          />

          <SectionEditor
            label="Closing"
            value={edited.closing}
            onChange={(v) => setEdited({ ...edited, closing: v })}
            annotations={annotationsBySection.closing ?? []}
            onApplyRewrite={(text, rewrite) =>
              applyRewriteTo("closing", text, rewrite)
            }
          />

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
            >
              Copy full letter
            </button>
            <span className="text-xs text-stone-500">
              Edits are local only — persistence ships in Phase 4.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function SectionEditor({
  label,
  value,
  onChange,
  annotations,
  onApplyRewrite,
  proofRefs,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  annotations: Annotation[];
  onApplyRewrite: (target: string, rewrite: string) => void;
  proofRefs?: string[];
}) {
  return (
    <div className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-stone-700">{label}</label>
        {proofRefs && proofRefs.length > 0 && (
          <span className="text-xs text-stone-500">
            Proof refs: {proofRefs.join(", ")}
          </span>
        )}
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={Math.max(3, Math.min(10, Math.ceil(value.length / 90) + 1))}
        className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
      />
      {annotations.length > 0 && (
        <div className="space-y-2 pt-1">
          {annotations.map((ann, i) => (
            <AnnotationCard
              key={i}
              ann={ann}
              onApply={
                ann.suggested_rewrite
                  ? (rewrite) => onApplyRewrite(ann.target_text, rewrite)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
