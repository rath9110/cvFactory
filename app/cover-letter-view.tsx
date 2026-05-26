"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  Annotation,
  AnnotationIssue,
  AnnotationResponseValue,
  CoverLetter,
  Critique,
  CVCritique,
  CVVariant,
  FeedbackBlock,
  OverallVerdict,
  StrategicBrief,
} from "@/lib/profile-types";

export type CVPayloadProvider = () =>
  | { variant: CVVariant; critique: CVCritique }
  | null;

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

function annotationKey(ann: Annotation): string {
  return `${ann.target_section}::${ann.target_text}`;
}

type AnnotationResponseState = {
  response: AnnotationResponseValue;
  comment: string;
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

const RESPONSE_OPTIONS: {
  value: AnnotationResponseValue;
  label: string;
  active: string;
  inactive: string;
}[] = [
  {
    value: "accept",
    label: "Accept",
    active: "bg-emerald-600 text-white border-emerald-700",
    inactive: "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50",
  },
  {
    value: "reject",
    label: "Reject",
    active: "bg-rose-600 text-white border-rose-700",
    inactive: "bg-white text-rose-800 border-rose-300 hover:bg-rose-50",
  },
  {
    value: "ignore",
    label: "Ignore",
    active: "bg-stone-700 text-white border-stone-800",
    inactive: "bg-white text-stone-700 border-stone-300 hover:bg-stone-50",
  },
];

function AnnotationCard({
  ann,
  response,
  onResponseChange,
  onCommentChange,
  onApplyRewrite,
}: {
  ann: Annotation;
  response: AnnotationResponseState | undefined;
  onResponseChange: (value: AnnotationResponseValue | null) => void;
  onCommentChange: (comment: string) => void;
  onApplyRewrite?: (rewrite: string) => void;
}) {
  return (
    <div className={`rounded-md border p-3 text-sm ${ISSUE_STYLES[ann.issue]}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium">
          {ISSUE_LABEL[ann.issue]}
        </span>
        <code className="max-w-[60%] truncate text-xs opacity-80">
          "{ann.target_text}"
        </code>
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
          {onApplyRewrite && (
            <button
              type="button"
              onClick={() => onApplyRewrite(ann.suggested_rewrite!)}
              className="text-xs font-medium underline underline-offset-2"
            >
              Apply rewrite
            </button>
          )}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/60 pt-2">
        <span className="text-xs font-medium uppercase tracking-wide opacity-70">
          Your call:
        </span>
        {RESPONSE_OPTIONS.map((opt) => {
          const active = response?.response === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onResponseChange(active ? null : opt.value)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                active ? opt.active : opt.inactive
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {response && (
        <input
          type="text"
          value={response.comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Why? (optional)"
          className="mt-2 w-full rounded border border-white/70 bg-white/80 px-2 py-1 text-xs"
        />
      )}
    </div>
  );
}

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

export default function CoverLetterView({
  jobAd,
  brief,
  getCVPayload,
}: {
  jobAd: string;
  brief: StrategicBrief;
  getCVPayload?: CVPayloadProvider;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CoverApiResponse | null>(null);
  const [edited, setEdited] = useState<EditableLetter | null>(null);

  const [annotationResponses, setAnnotationResponses] = useState<
    Record<string, AnnotationResponseState>
  >({});
  const [sectionComments, setSectionComments] = useState({
    opening: "",
    bridge: [] as string[],
    gap_acknowledgement: "",
    closing: "",
  });
  const [patternFlags, setPatternFlags] = useState<string[]>([]);
  const [patternDraft, setPatternDraft] = useState("");
  const [overallVerdict, setOverallVerdict] = useState<OverallVerdict | null>(null);
  const [overallComment, setOverallComment] = useState("");

  const [applicationId, setApplicationId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ kind: "idle" });

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setEdited(null);
    setAnnotationResponses({});
    setApplicationId(null);
    setSaveState({ kind: "idle" });
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
        setSectionComments({
          opening: "",
          bridge: r.letter.bridge.map(() => ""),
          gap_acknowledgement: "",
          closing: "",
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

  const updateAnnotationResponse = useCallback(
    (ann: Annotation, value: AnnotationResponseValue | null) => {
      const key = annotationKey(ann);
      setAnnotationResponses((prev) => {
        const next = { ...prev };
        if (value === null) {
          delete next[key];
        } else {
          next[key] = { response: value, comment: prev[key]?.comment ?? "" };
        }
        return next;
      });
    },
    []
  );

  const updateAnnotationComment = useCallback(
    (ann: Annotation, comment: string) => {
      const key = annotationKey(ann);
      setAnnotationResponses((prev) => {
        const existing = prev[key];
        if (!existing) return prev;
        return { ...prev, [key]: { ...existing, comment } };
      });
    },
    []
  );

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

  function addPatternFlag() {
    const trimmed = patternDraft.trim();
    if (!trimmed) return;
    setPatternFlags((prev) => [...prev, trimmed]);
    setPatternDraft("");
  }

  function removePatternFlag(idx: number) {
    setPatternFlags((prev) => prev.filter((_, i) => i !== idx));
  }

  async function onSave() {
    if (!result || !edited) return;
    setSaveState({ kind: "saving" });

    const letterEdited: CoverLetter = {
      recipient: result.letter.recipient,
      opening: edited.opening,
      bridge: edited.bridge.map((text, i) => ({
        text,
        proof_point_ids: result.letter.bridge[i]?.proof_point_ids ?? [],
      })),
      gap_acknowledgement:
        edited.gap_acknowledgement.trim().length > 0
          ? edited.gap_acknowledgement
          : undefined,
      closing: edited.closing,
      signoff: result.letter.signoff,
    };

    const feedback: FeedbackBlock = {
      overall_verdict: overallVerdict,
      overall_comment: overallComment,
      annotation_responses: Object.entries(annotationResponses).map(
        ([key, value]) => {
          const [section, ...rest] = key.split("::");
          return {
            annotation_target_text: rest.join("::"),
            annotation_section: section as
              | "opening"
              | "bridge"
              | "gap_acknowledgement"
              | "closing",
            response: value.response,
            comment: value.comment.trim().length > 0 ? value.comment : undefined,
          };
        }
      ),
      section_comments: sectionComments,
      pattern_flags: patternFlags,
    };

    const cvPayload = getCVPayload?.() ?? null;

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: applicationId ?? undefined,
          job_ad: jobAd,
          brief,
          letter_generated: result.letter,
          letter_edited: letterEdited,
          critique: result.critique,
          feedback,
          ...(cvPayload
            ? {
                cv_variant: cvPayload.variant,
                cv_critique: cvPayload.critique,
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveState({ kind: "error", message: data.error ?? `HTTP ${res.status}` });
      } else {
        setApplicationId(data.id);
        setSaveState({
          kind: "saved",
          at: new Date(data.updated_at).toLocaleTimeString(),
        });
      }
    } catch (e) {
      setSaveState({
        kind: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
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
            annotationResponses={annotationResponses}
            onResponseChange={updateAnnotationResponse}
            onCommentChange={updateAnnotationComment}
            onApplyRewrite={(text, rewrite) =>
              applyRewriteTo("opening", text, rewrite)
            }
            note={sectionComments.opening}
            onNoteChange={(v) =>
              setSectionComments({ ...sectionComments, opening: v })
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
                annotations={i === 0 ? annotationsBySection.bridge ?? [] : []}
                annotationResponses={annotationResponses}
                onResponseChange={updateAnnotationResponse}
                onCommentChange={updateAnnotationComment}
                onApplyRewrite={(text, rewrite) =>
                  applyRewriteToBridge(i, text, rewrite)
                }
                proofRefs={result.letter.bridge[i]?.proof_point_ids ?? []}
                note={sectionComments.bridge[i] ?? ""}
                onNoteChange={(v) => {
                  const next = {
                    ...sectionComments,
                    bridge: [...sectionComments.bridge],
                  };
                  next.bridge[i] = v;
                  setSectionComments(next);
                }}
              />
            ))}
          </div>

          <SectionEditor
            label="Gap acknowledgement (optional)"
            value={edited.gap_acknowledgement}
            onChange={(v) => setEdited({ ...edited, gap_acknowledgement: v })}
            annotations={annotationsBySection.gap_acknowledgement ?? []}
            annotationResponses={annotationResponses}
            onResponseChange={updateAnnotationResponse}
            onCommentChange={updateAnnotationComment}
            onApplyRewrite={(text, rewrite) =>
              applyRewriteTo("gap_acknowledgement", text, rewrite)
            }
            note={sectionComments.gap_acknowledgement}
            onNoteChange={(v) =>
              setSectionComments({ ...sectionComments, gap_acknowledgement: v })
            }
          />

          <SectionEditor
            label="Closing"
            value={edited.closing}
            onChange={(v) => setEdited({ ...edited, closing: v })}
            annotations={annotationsBySection.closing ?? []}
            annotationResponses={annotationResponses}
            onResponseChange={updateAnnotationResponse}
            onCommentChange={updateAnnotationComment}
            onApplyRewrite={(text, rewrite) =>
              applyRewriteTo("closing", text, rewrite)
            }
            note={sectionComments.closing}
            onNoteChange={(v) =>
              setSectionComments({ ...sectionComments, closing: v })
            }
          />

          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Pattern flags
              </h3>
              <p className="text-xs text-stone-500">
                Rules to apply across future applications — e.g., "never claim deep ML
                expertise" or "always anchor on 60+ markets for data roles".
              </p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={patternDraft}
                onChange={(e) => setPatternDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addPatternFlag();
                  }
                }}
                placeholder="Add a pattern flag…"
                className="flex-1 rounded-md border border-stone-300 bg-white p-2 text-sm focus:border-stone-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addPatternFlag}
                disabled={patternDraft.trim().length === 0}
                className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {patternFlags.length > 0 && (
              <ul className="space-y-1">
                {patternFlags.map((flag, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                  >
                    <span>{flag}</span>
                    <button
                      type="button"
                      onClick={() => removePatternFlag(i)}
                      className="text-xs text-stone-500 hover:text-stone-900"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Overall verdict
            </h3>
            <div className="flex gap-2">
              <VerdictButton
                value="worked"
                label="This letter worked"
                current={overallVerdict}
                onSelect={setOverallVerdict}
                tone="positive"
              />
              <VerdictButton
                value="felt_off"
                label="This felt off"
                current={overallVerdict}
                onSelect={setOverallVerdict}
                tone="negative"
              />
            </div>
            <textarea
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              rows={3}
              placeholder="What did or did not work? (optional)"
              className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm focus:border-stone-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saveState.kind === "saving"}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
            >
              {saveState.kind === "saving"
                ? "Saving…"
                : applicationId
                  ? "Save changes"
                  : "Save application"}
            </button>
            <button
              type="button"
              onClick={copyToClipboard}
              className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
            >
              Copy full letter
            </button>
            <SaveStatus state={saveState} applicationId={applicationId} />
          </div>
        </div>
      )}
    </section>
  );
}

function VerdictButton({
  value,
  label,
  current,
  onSelect,
  tone,
}: {
  value: OverallVerdict;
  label: string;
  current: OverallVerdict | null;
  onSelect: (v: OverallVerdict | null) => void;
  tone: "positive" | "negative";
}) {
  const active = current === value;
  const activeStyle =
    tone === "positive"
      ? "bg-emerald-600 text-white border-emerald-700"
      : "bg-rose-600 text-white border-rose-700";
  const inactiveStyle =
    tone === "positive"
      ? "bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-50"
      : "bg-white text-rose-800 border-rose-300 hover:bg-rose-50";
  return (
    <button
      type="button"
      onClick={() => onSelect(active ? null : value)}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
        active ? activeStyle : inactiveStyle
      }`}
    >
      {label}
    </button>
  );
}

function SaveStatus({
  state,
  applicationId,
}: {
  state: SaveState;
  applicationId: string | null;
}) {
  if (state.kind === "saved") {
    return (
      <span className="text-xs text-emerald-700">
        Saved at {state.at}
        {applicationId && (
          <code className="ml-2 text-stone-400">id: {applicationId}</code>
        )}
      </span>
    );
  }
  if (state.kind === "error") {
    return <span className="text-xs text-rose-700">Save failed: {state.message}</span>;
  }
  if (state.kind === "saving") {
    return <span className="text-xs text-stone-500">Saving…</span>;
  }
  return (
    <span className="text-xs text-stone-500">
      Stored locally at <code>data/applications/&lt;id&gt;.json</code>
    </span>
  );
}

function SectionEditor({
  label,
  value,
  onChange,
  annotations,
  annotationResponses,
  onResponseChange,
  onCommentChange,
  onApplyRewrite,
  proofRefs,
  note,
  onNoteChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  annotations: Annotation[];
  annotationResponses: Record<string, AnnotationResponseState>;
  onResponseChange: (ann: Annotation, value: AnnotationResponseValue | null) => void;
  onCommentChange: (ann: Annotation, comment: string) => void;
  onApplyRewrite: (target: string, rewrite: string) => void;
  proofRefs?: string[];
  note: string;
  onNoteChange: (v: string) => void;
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
      <input
        type="text"
        value={note}
        onChange={(e) => onNoteChange(e.target.value)}
        placeholder="Your notes on this section (optional)"
        className="w-full rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs"
      />
      {annotations.length > 0 && (
        <div className="space-y-2 pt-1">
          {annotations.map((ann, i) => {
            const key = annotationKey(ann);
            return (
              <AnnotationCard
                key={i}
                ann={ann}
                response={annotationResponses[key]}
                onResponseChange={(value) => onResponseChange(ann, value)}
                onCommentChange={(comment) => onCommentChange(ann, comment)}
                onApplyRewrite={
                  ann.suggested_rewrite
                    ? (rewrite) => onApplyRewrite(ann.target_text, rewrite)
                    : undefined
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
