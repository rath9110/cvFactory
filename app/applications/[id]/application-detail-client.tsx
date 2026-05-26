"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnnotationIssue,
  ApplicationSession,
  CoverLetter,
  CritiqueScores,
  Critique,
  CVCritique,
  CVVariant,
  OverallVerdict,
  StrategicBrief,
} from "@/lib/profile-types";
import {
  letterSectionDeltas,
  scoreDeltas,
  stringListDelta,
} from "@/lib/letter-compare";

type DetailResponse = { session: ApplicationSession };

type RegenerateResponse = {
  brief: StrategicBrief;
  letter: CoverLetter;
  critique: Critique;
  cv_variant: CVVariant;
  cv_critique: CVCritique;
  profile_signature: string;
  learned_preferences_count: number;
  mocked: boolean;
};

const ISSUE_LABEL: Record<AnnotationIssue, string> = {
  unsupported_claim: "Unsupported claim",
  generic_platitude: "Generic",
  drift_from_brief: "Drift from brief",
  tone_mismatch: "Tone mismatch",
  voice_unnatural: "Voice off",
  good: "Strength",
};

const ISSUE_STYLES: Record<AnnotationIssue, string> = {
  unsupported_claim: "border-rose-300 bg-rose-50 text-rose-900",
  generic_platitude: "border-amber-300 bg-amber-50 text-amber-900",
  drift_from_brief: "border-orange-300 bg-orange-50 text-orange-900",
  tone_mismatch: "border-purple-300 bg-purple-50 text-purple-900",
  voice_unnatural: "border-sky-300 bg-sky-50 text-sky-900",
  good: "border-emerald-300 bg-emerald-50 text-emerald-900",
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

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      {children}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: OverallVerdict | null }) {
  if (verdict === "worked")
    return (
      <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        worked
      </span>
    );
  if (verdict === "felt_off")
    return (
      <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
        felt off
      </span>
    );
  return <span className="text-xs text-stone-400">no verdict</span>;
}

function ScoreGrid({ scores }: { scores: CritiqueScores }) {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <ScoreBar label="Relevance" score={scores.relevance} />
      <ScoreBar label="Specificity" score={scores.specificity} />
      <ScoreBar label="Honesty" score={scores.honesty} />
      <ScoreBar label="Tone fit" score={scores.tone_fit} />
    </div>
  );
}

function fullLetterText(session: ApplicationSession): string {
  const l = session.letter_edited;
  return [
    l.opening,
    "",
    ...l.bridge.flatMap((p) => [p.text, ""]),
    ...(l.gap_acknowledgement?.trim() ? [l.gap_acknowledgement, ""] : []),
    l.closing,
    "",
    l.signoff,
  ].join("\n");
}

export default function ApplicationDetail({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ApplicationSession | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerated, setRegenerated] = useState<RegenerateResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/applications/${id}`, { method: "GET" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
        else setSession((data as DetailResponse).session);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onDelete() {
    if (!confirm("Delete this saved application? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/applications/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Delete failed (${res.status})`);
        setDeleting(false);
        return;
      }
      router.push("/applications");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setDeleting(false);
    }
  }

  async function copyLetter() {
    if (!session) return;
    try {
      await navigator.clipboard.writeText(fullLetterText(session));
    } catch {
      // ignore
    }
  }

  async function onRegenerate() {
    setRegenerating(true);
    setRegenerateError(null);
    setRegenerated(null);
    try {
      const res = await fetch(`/api/applications/${id}/regenerate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setRegenerateError(data.error ?? `HTTP ${res.status}`);
      } else {
        setRegenerated(data as RegenerateResponse);
      }
    } catch (e) {
      setRegenerateError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRegenerating(false);
    }
  }

  if (loading) return <p className="text-sm text-stone-600">Loading…</p>;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!session) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-stone-500">
          Created {new Date(session.created_at).toLocaleString()} · Updated{" "}
          {new Date(session.updated_at).toLocaleString()}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyLetter}
            className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
          >
            Copy letter
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      <Card title="Job ad">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-stone-800">
          {session.job_ad}
        </pre>
      </Card>

      <Card title="Strategic brief">
        <div className="space-y-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Job summary
            </h3>
            <p className="mt-1 text-sm leading-relaxed">
              {session.brief.job_summary}
            </p>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Lead with
            </h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {session.brief.lead_with.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Do not fake
            </h3>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {session.brief.do_not_fake.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
              Positioning memo
            </h3>
            <p className="mt-1 text-sm leading-relaxed">
              {session.brief.positioning_memo}
            </p>
          </div>
        </div>
      </Card>

      <Card title="Critique scores">
        <ScoreGrid scores={session.critique.scores} />
        <p className="mt-3 text-sm leading-relaxed text-stone-700">
          {session.critique.verdict}
        </p>
      </Card>

      <Card title="Cover letter (your edited version)">
        <div className="space-y-3 whitespace-pre-wrap text-sm leading-relaxed">
          <p>{session.letter_edited.opening}</p>
          {session.letter_edited.bridge.map((p, i) => (
            <p key={i}>{p.text}</p>
          ))}
          {session.letter_edited.gap_acknowledgement && (
            <p className="text-stone-700">
              {session.letter_edited.gap_acknowledgement}
            </p>
          )}
          <p>{session.letter_edited.closing}</p>
          <p className="text-stone-500">{session.letter_edited.signoff}</p>
        </div>
      </Card>

      {session.critique.annotations.length > 0 && (
        <Card title="Critique annotations">
          <ul className="space-y-2">
            {session.critique.annotations.map((ann, i) => (
              <li
                key={i}
                className={`rounded-md border p-3 text-sm ${ISSUE_STYLES[ann.issue]}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium">
                    {ISSUE_LABEL[ann.issue]}
                  </span>
                  <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs">
                    {ann.target_section}
                  </span>
                </div>
                <code className="block text-xs opacity-80">"{ann.target_text}"</code>
                <p className="mt-1">{ann.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Your feedback">
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <VerdictBadge verdict={session.feedback.overall_verdict} />
            {session.feedback.overall_comment && (
              <span className="text-stone-700">
                — {session.feedback.overall_comment}
              </span>
            )}
          </div>

          {session.feedback.pattern_flags.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Pattern flags
              </h3>
              <ul className="mt-1 list-disc pl-5">
                {session.feedback.pattern_flags.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {session.feedback.annotation_responses.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Annotation responses
              </h3>
              <ul className="mt-1 space-y-1">
                {session.feedback.annotation_responses.map((r, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-semibold uppercase">{r.response}</span>
                    {" · "}
                    <span className="text-stone-500">{r.annotation_section}</span>
                    {" · "}
                    <code>"{r.annotation_target_text.slice(0, 60)}"</code>
                    {r.comment && (
                      <span className="text-stone-600"> — {r.comment}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(session.feedback.section_comments.opening ||
            session.feedback.section_comments.closing ||
            session.feedback.section_comments.gap_acknowledgement ||
            session.feedback.section_comments.bridge.some(
              (b) => b.trim().length > 0
            )) && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                Section notes
              </h3>
              <ul className="mt-1 space-y-1 text-xs">
                {session.feedback.section_comments.opening && (
                  <li>
                    <span className="font-semibold">Opening:</span>{" "}
                    {session.feedback.section_comments.opening}
                  </li>
                )}
                {session.feedback.section_comments.bridge.map((b, i) =>
                  b.trim() ? (
                    <li key={i}>
                      <span className="font-semibold">Bridge {i + 1}:</span> {b}
                    </li>
                  ) : null
                )}
                {session.feedback.section_comments.gap_acknowledgement && (
                  <li>
                    <span className="font-semibold">Gap:</span>{" "}
                    {session.feedback.section_comments.gap_acknowledgement}
                  </li>
                )}
                {session.feedback.section_comments.closing && (
                  <li>
                    <span className="font-semibold">Closing:</span>{" "}
                    {session.feedback.section_comments.closing}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </Card>

      {session.cv_variant && session.cv_critique && (
        <SavedCV
          sessionId={session.id}
          variant={session.cv_variant}
          critique={session.cv_critique}
        />
      )}

      <RegenerateSection
        session={session}
        regenerating={regenerating}
        error={regenerateError}
        result={regenerated}
        onRegenerate={onRegenerate}
      />
    </div>
  );
}

function SavedCV({
  sessionId,
  variant,
  critique,
}: {
  sessionId: string;
  variant: ApplicationSession["cv_variant"];
  critique: ApplicationSession["cv_critique"];
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!variant || !critique) return null;

  async function onDownload() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/cv/latex", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variant,
          filename: `cv-${sessionId}.tex`,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cv-${sessionId}.tex`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <Card title="CV variant — emphasis notes">
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1 text-sm leading-relaxed">{variant.emphasis_notes}</p>
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="shrink-0 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? "Downloading…" : "Download .tex"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
      </Card>

      <Card title="CV variant — structure">
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Profile summary
            </h3>
            <p className="leading-relaxed">{variant.profile_summary}</p>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Experience (in order)
            </h3>
            <div className="space-y-3">
              {variant.experience_order.map((id) => {
                const block = variant.experience.find((e) => e.block_id === id);
                if (!block) return null;
                return (
                  <div key={id}>
                    <div className="font-mono text-xs text-stone-500">{id}</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 leading-relaxed">
                      {block.bullets.map((b, i) => (
                        <li key={i}>{b}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Skills
            </h3>
            <ul className="space-y-1">
              {variant.skills.map((g, i) => (
                <li key={i}>
                  <span className="font-semibold">{g.category}: </span>
                  <span>{g.items.join(", ")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card title="CV variant — critique scores">
        <ScoreGrid scores={critique.scores} />
        <p className="mt-3 text-sm leading-relaxed text-stone-700">
          {critique.verdict}
        </p>
      </Card>
    </>
  );
}

function deltaFmt(d: number): string {
  if (d === 0) return "±0";
  return d > 0 ? `+${d}` : `${d}`;
}

function deltaColor(d: number): string {
  if (d === 0) return "text-stone-500";
  return d > 0 ? "text-emerald-700" : "text-rose-700";
}

function fractionColor(f: number): string {
  if (f >= 0.5) return "bg-rose-100 text-rose-900";
  if (f >= 0.2) return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-900";
}

function RegenerateSection({
  session,
  regenerating,
  error,
  result,
  onRegenerate,
}: {
  session: ApplicationSession;
  regenerating: boolean;
  error: string | null;
  result: RegenerateResponse | null;
  onRegenerate: () => void;
}) {
  const sectionDeltas = useMemo(
    () => (result ? letterSectionDeltas(session.letter_edited, result.letter) : null),
    [result, session.letter_edited]
  );
  const sDeltas = useMemo(
    () => (result ? scoreDeltas(session.critique.scores, result.critique.scores) : null),
    [result, session.critique.scores]
  );
  const leadWithDelta = useMemo(
    () =>
      result ? stringListDelta(session.brief.lead_with, result.brief.lead_with) : null,
    [result, session.brief.lead_with]
  );

  return (
    <Card title="Regenerate against current master profile">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-stone-600">
          Re-runs the analyzer + cover + CV pipeline against{" "}
          <code>master_profile.json</code> as it stands now — including any{" "}
          <code>learned_preferences</code> you accepted on the Learning page. The
          saved session above is not modified.
        </p>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {regenerating
            ? "Regenerating…"
            : result
              ? "Regenerate again"
              : "Regenerate"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      {result && sectionDeltas && sDeltas && leadWithDelta && (
        <div className="mt-5 space-y-5">
          {result.mocked && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Mock output.</strong> Mock generators are deterministic for a
              given profile, so the regenerated draft only differs from the saved
              one if the master profile has changed. Set{" "}
              <code>ANTHROPIC_API_KEY</code> for live regeneration.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
            <span>
              Master profile signature:{" "}
              <code className="text-stone-800">{result.profile_signature}</code>
            </span>
            <span>
              Learned preferences in profile:{" "}
              <code>{result.learned_preferences_count}</code>
            </span>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Score deltas (regenerated − saved)
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(
                [
                  ["Relevance", sDeltas.relevance],
                  ["Specificity", sDeltas.specificity],
                  ["Honesty", sDeltas.honesty],
                  ["Tone fit", sDeltas.tone_fit],
                ] as [string, number][]
              ).map(([label, d]) => (
                <div
                  key={label}
                  className="rounded border border-stone-200 bg-stone-50 px-3 py-2 text-sm"
                >
                  <div className="text-xs text-stone-500">{label}</div>
                  <div className={`text-base font-semibold ${deltaColor(d)}`}>
                    {deltaFmt(d)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Cover letter — edit fraction per section
            </h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {(
                [
                  ["Opening", sectionDeltas.opening],
                  ["Bridge (avg)", sectionDeltas.bridge_avg],
                  ["Gap ack.", sectionDeltas.gap_acknowledgement],
                  ["Closing", sectionDeltas.closing],
                ] as [string, number][]
              ).map(([label, f]) => (
                <div
                  key={label}
                  className={`rounded px-3 py-2 text-sm ${fractionColor(f)}`}
                >
                  <div className="text-xs opacity-80">{label}</div>
                  <div className="text-base font-semibold tabular-nums">
                    {Math.round(f * 100)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
              Brief — lead with
            </h3>
            <ul className="space-y-1 text-sm">
              {leadWithDelta.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    className={
                      item.status === "added"
                        ? "rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800"
                        : item.status === "removed"
                          ? "rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800"
                          : "rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-600"
                    }
                  >
                    {item.status === "added"
                      ? "+"
                      : item.status === "removed"
                        ? "−"
                        : "="}
                  </span>
                  <span
                    className={
                      item.status === "removed" ? "text-stone-500 line-through" : ""
                    }
                  >
                    {item.text}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Saved letter (final edited version)
              </h3>
              <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
                <p>{session.letter_edited.opening}</p>
                {session.letter_edited.bridge.map((p, i) => (
                  <p key={i}>{p.text}</p>
                ))}
                {session.letter_edited.gap_acknowledgement && (
                  <p className="text-stone-700">
                    {session.letter_edited.gap_acknowledgement}
                  </p>
                )}
                <p>{session.letter_edited.closing}</p>
              </div>
            </div>
            <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                Regenerated draft (current master profile)
              </h3>
              <div className="space-y-2 whitespace-pre-wrap leading-relaxed">
                <p>{result.letter.opening}</p>
                {result.letter.bridge.map((p, i) => (
                  <p key={i}>{p.text}</p>
                ))}
                {result.letter.gap_acknowledgement && (
                  <p className="text-stone-700">
                    {result.letter.gap_acknowledgement}
                  </p>
                )}
                <p>{result.letter.closing}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-stone-500">
            Regenerated output is not saved. To capture it as a new application,
            paste the job ad into the analyzer and save from there.
          </p>
        </div>
      )}
    </Card>
  );
}
