"use client";

import { useMemo, useState } from "react";
import type {
  AnnotationIssue,
  Certification,
  CVAnnotation,
  CVCritique,
  CVVariant,
  Education,
  ExperienceBlock,
  StrategicBrief,
} from "@/lib/profile-types";

type ProfileSnapshot = {
  name: string;
  contact: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    github?: string;
  };
  experience_blocks: ExperienceBlock[];
  education: Education[];
  certifications: Certification[];
  languages: string[];
};

type CvApiResponse = {
  variant: CVVariant;
  critique: CVCritique;
  mocked: boolean;
  profile_snapshot: ProfileSnapshot;
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

function AnnotationCard({ ann }: { ann: CVAnnotation }) {
  return (
    <div className={`rounded-md border p-3 text-sm ${ISSUE_STYLES[ann.issue]}`}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium">
          {ISSUE_LABEL[ann.issue]}
        </span>
        <span className="rounded bg-white/70 px-1.5 py-0.5 text-xs font-medium">
          {ann.target_section}
          {ann.target_block_id && ` · ${ann.target_block_id}`}
        </span>
        <code className="max-w-[60%] truncate text-xs opacity-80">
          "{ann.target_text}"
        </code>
      </div>
      <p>{ann.note}</p>
      {ann.suggested_rewrite && (
        <div className="mt-2 rounded border border-white/60 bg-white/70 p-2 text-sm">
          <div className="mb-1 text-xs font-medium uppercase tracking-wide opacity-70">
            Suggested rewrite
          </div>
          {ann.suggested_rewrite}
        </div>
      )}
    </div>
  );
}

function ContactLine({ snapshot }: { snapshot: ProfileSnapshot }) {
  const parts: string[] = [];
  if (snapshot.contact.location) parts.push(snapshot.contact.location);
  if (snapshot.contact.phone) parts.push(snapshot.contact.phone);
  if (snapshot.contact.email) parts.push(snapshot.contact.email);
  if (snapshot.contact.linkedin) parts.push(snapshot.contact.linkedin);
  if (snapshot.contact.github) parts.push(snapshot.contact.github);
  return <div className="text-xs text-stone-600">{parts.join(" • ")}</div>;
}

function PreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-[#1F4E79] pb-1">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-[#1F4E79]">
        {title}
      </h3>
      <div>{children}</div>
    </div>
  );
}

function PreviewPaper({
  variant,
  snapshot,
}: {
  variant: CVVariant;
  snapshot: ProfileSnapshot;
}) {
  const blockById = useMemo(
    () => new Map(snapshot.experience_blocks.map((b) => [b.id, b])),
    [snapshot.experience_blocks]
  );

  return (
    <div className="space-y-3 rounded-lg border border-stone-300 bg-white p-6 font-serif text-stone-900 shadow-sm">
      <div>
        <h2 className="text-2xl font-bold text-[#1F4E79]">{snapshot.name}</h2>
        <ContactLine snapshot={snapshot} />
      </div>

      <PreviewSection title="Profile">
        <p className="text-sm leading-relaxed">{variant.profile_summary}</p>
      </PreviewSection>

      <PreviewSection title="Experience">
        <div className="space-y-3">
          {variant.experience_order.map((id) => {
            const block = blockById.get(id);
            const varBlock = variant.experience.find((e) => e.block_id === id);
            if (!block || !varBlock) return null;
            return (
              <div key={id}>
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="font-semibold">{block.role}</span>{" "}
                    <span className="text-stone-500">|</span>{" "}
                    <span className="italic text-stone-600">{block.company}</span>
                  </div>
                  <span className="text-xs text-stone-500">{block.period}</span>
                </div>
                {block.context && (
                  <p className="mt-1 text-sm leading-relaxed">{block.context}</p>
                )}
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm leading-relaxed">
                  {varBlock.bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </PreviewSection>

      {snapshot.education.length > 0 && (
        <PreviewSection title="Education">
          {snapshot.education.map((e) => (
            <div key={e.id} className="text-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-semibold">{e.degree}</span>
                <span className="text-xs text-stone-500">{e.period}</span>
              </div>
              <div className="italic text-stone-600">{e.institution}</div>
              {e.focus && <div className="text-xs text-stone-500">{e.focus}</div>}
            </div>
          ))}
        </PreviewSection>
      )}

      {snapshot.certifications.length > 0 && (
        <PreviewSection title="Certifications">
          <p className="text-sm">
            {snapshot.certifications.map((c) => c.name).join(" • ")}
          </p>
        </PreviewSection>
      )}

      <PreviewSection title="Skills & Tools">
        <div className="space-y-1">
          {variant.skills.map((g, i) => (
            <div key={i} className="text-sm">
              <span className="font-semibold">{g.category}: </span>
              <span>{g.items.join(", ")}</span>
            </div>
          ))}
          {snapshot.languages.length > 0 && (
            <div className="text-sm">
              <span className="font-semibold">Languages: </span>
              <span>{snapshot.languages.join(", ")}</span>
            </div>
          )}
        </div>
      </PreviewSection>
    </div>
  );
}

export default function CVView({ brief }: { brief: StrategicBrief }) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvApiResponse | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/cv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResult(data as CvApiResponse);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onDownloadTex() {
    if (!result) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/cv/latex", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variant: result.variant,
          filename: "rasmus_thunberg_cv.tex",
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
      link.download = "rasmus_thunberg_cv.tex";
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
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">CV variant</h2>
        <div className="flex gap-2">
          {result && (
            <button
              type="button"
              onClick={onDownloadTex}
              disabled={downloading}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {downloading ? "Downloading…" : "Download .tex"}
            </button>
          )}
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
                : "Generate CV variant"}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-rose-700">{error}</p>}

      {result && (
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

          <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Emphasis notes
            </h3>
            <p className="text-sm leading-relaxed">{result.variant.emphasis_notes}</p>
          </div>

          <PreviewPaper variant={result.variant} snapshot={result.profile_snapshot} />

          {result.critique.annotations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Annotations
              </h3>
              {result.critique.annotations.map((ann, i) => (
                <AnnotationCard key={i} ann={ann} />
              ))}
            </div>
          )}

          <p className="text-xs text-stone-500">
            CV variant editing + per-annotation feedback ship in a later pass —
            Phase 3 lands the generation, critique, preview, and .tex export.
          </p>
        </div>
      )}
    </section>
  );
}
