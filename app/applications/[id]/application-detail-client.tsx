"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnnotationIssue,
  ApplicationSession,
  CritiqueScores,
  OverallVerdict,
} from "@/lib/profile-types";

type DetailResponse = { session: ApplicationSession };

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
        <>
          <Card title="CV variant — emphasis notes">
            <p className="text-sm leading-relaxed">
              {session.cv_variant.emphasis_notes}
            </p>
          </Card>
          <Card title="CV variant — critique scores">
            <ScoreGrid scores={session.cv_critique.scores} />
            <p className="mt-3 text-sm leading-relaxed text-stone-700">
              {session.cv_critique.verdict}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
