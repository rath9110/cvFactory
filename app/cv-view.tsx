"use client";

import { useEffect, useMemo, useState } from "react";
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

export type CVPayload = {
  variant: CVVariant;
  critique: CVCritique;
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

type EditedCV = {
  profile_summary: string;
  experience_bullets: Record<string, string>; // blockId → newline-separated bullets
  skills_items: Record<string, string>; // category → comma-separated items
  experience_order: string[];
  emphasis_notes: string;
};

function hydrate(variant: CVVariant): EditedCV {
  const experience_bullets: Record<string, string> = {};
  for (const e of variant.experience) {
    experience_bullets[e.block_id] = e.bullets.join("\n");
  }
  const skills_items: Record<string, string> = {};
  for (const g of variant.skills) {
    skills_items[g.category] = g.items.join(", ");
  }
  return {
    profile_summary: variant.profile_summary,
    experience_bullets,
    skills_items,
    experience_order: [...variant.experience_order],
    emphasis_notes: variant.emphasis_notes,
  };
}

function rebuildVariant(edited: EditedCV, original: CVVariant): CVVariant {
  return {
    profile_summary: edited.profile_summary,
    experience_order: edited.experience_order,
    experience: edited.experience_order.map((blockId) => ({
      block_id: blockId,
      bullets: (edited.experience_bullets[blockId] ?? "")
        .split("\n")
        .map((b) => b.trim())
        .filter((b) => b.length > 0),
    })),
    skills: original.skills.map((g) => ({
      category: g.category,
      items: (edited.skills_items[g.category] ?? "")
        .split(",")
        .map((i) => i.trim())
        .filter((i) => i.length > 0),
    })),
    emphasis_notes: edited.emphasis_notes,
  };
}

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
  ann: CVAnnotation;
  onApply?: (rewrite: string) => void;
}) {
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

export default function CVView({
  brief,
  onPayloadChange,
}: {
  brief: StrategicBrief;
  onPayloadChange?: (payload: CVPayload | null) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CvApiResponse | null>(null);
  const [edited, setEdited] = useState<EditedCV | null>(null);

  const currentVariant = useMemo(() => {
    if (!result || !edited) return null;
    return rebuildVariant(edited, result.variant);
  }, [result, edited]);

  useEffect(() => {
    if (!onPayloadChange) return;
    if (currentVariant && result) {
      onPayloadChange({ variant: currentVariant, critique: result.critique });
    } else {
      onPayloadChange(null);
    }
  }, [currentVariant, result, onPayloadChange]);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setEdited(null);
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
        const r = data as CvApiResponse;
        setResult(r);
        setEdited(hydrate(r.variant));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function onDownloadTex() {
    if (!currentVariant) return;
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch("/api/cv/latex", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          variant: currentVariant,
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

  function applyAnnotationRewrite(ann: CVAnnotation) {
    if (!ann.suggested_rewrite || !edited) return;
    const rewrite = ann.suggested_rewrite;
    setEdited((prev) => {
      if (!prev) return prev;
      if (ann.target_section === "profile_summary") {
        const current = prev.profile_summary;
        return {
          ...prev,
          profile_summary: current.includes(ann.target_text)
            ? current.replace(ann.target_text, rewrite)
            : rewrite,
        };
      }
      if (ann.target_section === "experience" && ann.target_block_id) {
        const current = prev.experience_bullets[ann.target_block_id] ?? "";
        const next = current.includes(ann.target_text)
          ? current.replace(ann.target_text, rewrite)
          : current + "\n" + rewrite;
        return {
          ...prev,
          experience_bullets: {
            ...prev.experience_bullets,
            [ann.target_block_id]: next,
          },
        };
      }
      if (ann.target_section === "skills") {
        const found = Object.entries(prev.skills_items).find(([, items]) =>
          items.includes(ann.target_text)
        );
        if (found) {
          const [cat, items] = found;
          return {
            ...prev,
            skills_items: {
              ...prev.skills_items,
              [cat]: items.replace(ann.target_text, rewrite),
            },
          };
        }
      }
      return prev;
    });
  }

  function moveBlock(idx: number, delta: number) {
    if (!edited) return;
    const order = [...edited.experience_order];
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    setEdited({ ...edited, experience_order: order });
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">CV variant</h2>
        <div className="flex gap-2">
          {result && currentVariant && (
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

      {result && edited && currentVariant && (
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
            <p className="text-sm leading-relaxed">{currentVariant.emphasis_notes}</p>
          </div>

          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <label className="text-sm font-semibold text-stone-700">
              Profile summary
            </label>
            <textarea
              value={edited.profile_summary}
              onChange={(e) =>
                setEdited({ ...edited, profile_summary: e.target.value })
              }
              rows={4}
              className="w-full rounded-md border border-stone-300 bg-white p-3 text-sm shadow-sm focus:border-stone-500 focus:outline-none"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Experience (drag-free reorder via arrows; bullets — one per line)
            </h3>
            {edited.experience_order.map((blockId, idx) => {
              const block = result.profile_snapshot.experience_blocks.find(
                (b) => b.id === blockId
              );
              if (!block) return null;
              const value = edited.experience_bullets[blockId] ?? "";
              return (
                <div
                  key={blockId}
                  className="space-y-2 rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold">{block.role}</span>{" "}
                      <span className="text-stone-500">|</span>{" "}
                      <span className="italic text-stone-600">{block.company}</span>{" "}
                      <span className="text-xs text-stone-400">({block.period})</span>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveBlock(idx, -1)}
                        disabled={idx === 0}
                        className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBlock(idx, 1)}
                        disabled={idx === edited.experience_order.length - 1}
                        className="rounded border border-stone-300 px-2 py-0.5 text-xs hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={value}
                    onChange={(e) =>
                      setEdited({
                        ...edited,
                        experience_bullets: {
                          ...edited.experience_bullets,
                          [blockId]: e.target.value,
                        },
                      })
                    }
                    rows={Math.max(
                      3,
                      Math.min(10, value.split("\n").length + 1)
                    )}
                    className="w-full rounded-md border border-stone-300 bg-white p-3 font-mono text-xs leading-relaxed shadow-sm focus:border-stone-500 focus:outline-none"
                  />
                </div>
              );
            })}
          </div>

          <div className="space-y-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
              Skills (comma-separated within each category)
            </h3>
            <div className="space-y-2">
              {result.variant.skills.map((g) => (
                <div key={g.category} className="grid grid-cols-[180px_1fr] gap-3">
                  <label className="text-sm font-medium text-stone-700">
                    {g.category}
                  </label>
                  <input
                    type="text"
                    value={edited.skills_items[g.category] ?? ""}
                    onChange={(e) =>
                      setEdited({
                        ...edited,
                        skills_items: {
                          ...edited.skills_items,
                          [g.category]: e.target.value,
                        },
                      })
                    }
                    className="rounded-md border border-stone-300 bg-white p-2 text-sm focus:border-stone-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </div>

          <PreviewPaper variant={currentVariant} snapshot={result.profile_snapshot} />

          {result.critique.annotations.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
                Annotations
              </h3>
              {result.critique.annotations.map((ann, i) => (
                <AnnotationCard
                  key={i}
                  ann={ann}
                  onApply={
                    ann.suggested_rewrite
                      ? () => applyAnnotationRewrite(ann)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          <p className="text-xs text-stone-500">
            Edits are local until you click <strong>Save application</strong> in the
            cover letter section below — the CV variant rides along in the same
            session record.
          </p>
        </div>
      )}
    </section>
  );
}
