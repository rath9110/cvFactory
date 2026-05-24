"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CritiqueScores, OverallVerdict } from "@/lib/profile-types";

type SessionSummary = {
  id: string;
  created_at: string;
  updated_at: string;
  job_snippet: string;
  verdict: OverallVerdict | null;
  scores: CritiqueScores;
  has_cv: boolean;
};

type ListResponse = { sessions: SessionSummary[] };

function VerdictBadge({ verdict }: { verdict: OverallVerdict | null }) {
  if (verdict === "worked")
    return (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
        worked
      </span>
    );
  if (verdict === "felt_off")
    return (
      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-medium text-rose-800">
        felt off
      </span>
    );
  return <span className="text-xs text-stone-400">—</span>;
}

export default function ApplicationsList() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/applications", { method: "GET" });
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
        else setSessions((data as ListResponse).sessions);
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
  }, []);

  if (loading) return <p className="text-sm text-stone-600">Loading…</p>;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;

  if (sessions.length === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
        No saved applications yet. Generate a cover letter on the{" "}
        <Link href="/" className="font-medium underline underline-offset-2">
          analyzer
        </Link>{" "}
        and click <strong>Save application</strong>.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <th className="px-3 py-2">Saved</th>
            <th className="px-3 py-2">Job ad</th>
            <th className="px-3 py-2">Verdict</th>
            <th className="px-3 py-2 text-right">Relevance</th>
            <th className="px-3 py-2 text-right">Specificity</th>
            <th className="px-3 py-2 text-right">Honesty</th>
            <th className="px-3 py-2 text-right">Tone fit</th>
            <th className="px-3 py-2">CV</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr
              key={s.id}
              className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50"
            >
              <td className="px-3 py-2 text-xs">
                <Link
                  href={`/applications/${s.id}`}
                  className="font-medium text-stone-900 underline-offset-2 hover:underline"
                >
                  {new Date(s.updated_at).toLocaleString()}
                </Link>
                <div className="text-[11px] text-stone-400">{s.id}</div>
              </td>
              <td className="px-3 py-2 max-w-md truncate text-stone-700">
                {s.job_snippet}
                {s.job_snippet.length >= 120 && "…"}
              </td>
              <td className="px-3 py-2">
                <VerdictBadge verdict={s.verdict} />
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {s.scores.relevance}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {s.scores.specificity}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {s.scores.honesty}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {s.scores.tone_fit}
              </td>
              <td className="px-3 py-2 text-xs text-stone-500">
                {s.has_cv ? "✓" : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
