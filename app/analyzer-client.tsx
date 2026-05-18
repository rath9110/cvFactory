"use client";

import { useState } from "react";
import type { StrategicBrief, Requirement } from "@/lib/profile-types";

type ApiResponse = {
  brief: StrategicBrief;
  mocked: boolean;
  profileName: string;
};

const STATUS_STYLES: Record<Requirement["match_status"], string> = {
  strong: "bg-emerald-100 text-emerald-900 border-emerald-200",
  partial_reframeable: "bg-amber-100 text-amber-900 border-amber-200",
  gap: "bg-rose-100 text-rose-900 border-rose-200",
};

const STATUS_LABEL: Record<Requirement["match_status"], string> = {
  strong: "Strong",
  partial_reframeable: "Partial — reframe",
  gap: "Gap",
};

const KIND_LABEL: Record<Requirement["kind"], string> = {
  must_have: "Must-have",
  nice_to_have: "Nice-to-have",
  implicit_signal: "Implicit signal",
};

export default function AnalyzerClient() {
  const [jobAd, setJobAd] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function onAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jobAd }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResult(data as ApiResponse);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <label htmlFor="jobAd" className="block text-sm font-medium">
          Job ad
        </label>
        <textarea
          id="jobAd"
          value={jobAd}
          onChange={(e) => setJobAd(e.target.value)}
          rows={12}
          placeholder="Paste the full job ad here…"
          className="w-full rounded-md border border-stone-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-stone-500 focus:outline-none"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={loading || jobAd.trim().length < 20}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {loading ? "Analyzing…" : "Analyze"}
          </button>
          {error && <span className="text-sm text-rose-700">{error}</span>}
        </div>
      </section>

      {result && (
        <section className="space-y-6">
          {result.mocked && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Mock output.</strong> Set <code>ANTHROPIC_API_KEY</code> in{" "}
              <code>.env.local</code> and restart to get a real strategic brief.
            </div>
          )}

          <BriefCard title="Job summary">
            <p className="text-sm leading-relaxed">{result.brief.job_summary}</p>
          </BriefCard>

          <BriefCard title="Requirements">
            <ul className="space-y-3">
              {result.brief.requirements.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-md border p-3 text-sm ${STATUS_STYLES[r.match_status]}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-medium">
                      {KIND_LABEL[r.kind]}
                    </span>
                    <span className="rounded bg-white/60 px-1.5 py-0.5 text-xs font-medium">
                      {STATUS_LABEL[r.match_status]}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{r.text}</p>
                  <p className="mt-1 text-sm opacity-90">{r.reasoning}</p>
                  {r.proof_point_ids.length > 0 && (
                    <p className="mt-1 text-xs opacity-75">
                      Proof: {r.proof_point_ids.join(", ")}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </BriefCard>

          <div className="grid gap-4 md:grid-cols-2">
            <BriefCard title="Lead with">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.brief.lead_with.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </BriefCard>

            <BriefCard title="Do not fake">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {result.brief.do_not_fake.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </BriefCard>
          </div>

          {result.brief.reframe.length > 0 && (
            <BriefCard title="Reframe">
              <ul className="space-y-2 text-sm">
                {result.brief.reframe.map((r, i) => (
                  <li key={i} className="rounded border border-stone-200 bg-stone-50 p-2">
                    <div>
                      <span className="font-medium">From:</span> {r.from}
                    </div>
                    <div>
                      <span className="font-medium">To:</span> {r.to}
                    </div>
                    <div className="text-stone-600">
                      <span className="font-medium">Why:</span> {r.reason}
                    </div>
                  </li>
                ))}
              </ul>
            </BriefCard>
          )}

          <BriefCard title="Positioning memo">
            <p className="text-sm leading-relaxed">{result.brief.positioning_memo}</p>
          </BriefCard>
        </section>
      )}
    </div>
  );
}

function BriefCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h2>
      {children}
    </div>
  );
}
