"use client";

import { useEffect, useState } from "react";
import type { LearningProposal } from "@/lib/profile-types";
import type {
  AggregateStats,
  SessionSummary,
} from "@/lib/learn-aggregator";

type LearnResponse = {
  stats: AggregateStats;
  per_session: SessionSummary[];
  proposals: LearningProposal[];
  mocked: boolean;
  accepted_count: number;
};

type ProposalState =
  | { kind: "pending" }
  | { kind: "applying" }
  | { kind: "accepted"; id: string }
  | { kind: "rejected" }
  | { kind: "error"; message: string };

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function fmtScore(s: number | undefined): string {
  if (s === undefined || Number.isNaN(s)) return "—";
  return s.toFixed(1);
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-stone-600">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

export default function LearnClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<LearnResponse | null>(null);
  const [proposalState, setProposalState] = useState<Record<string, ProposalState>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/learn", { method: "GET" });
        const d = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(d.error ?? `Request failed (${res.status})`);
        else setData(d as LearnResponse);
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

  async function onAccept(proposal: LearningProposal) {
    setProposalState((p) => ({ ...p, [proposal.id]: { kind: "applying" } }));
    try {
      const res = await fetch("/api/learn/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ proposal }),
      });
      const d = await res.json();
      if (!res.ok) {
        setProposalState((p) => ({
          ...p,
          [proposal.id]: {
            kind: "error",
            message: d.error ?? `HTTP ${res.status}`,
          },
        }));
        return;
      }
      setProposalState((p) => ({
        ...p,
        [proposal.id]: { kind: "accepted", id: d.id },
      }));
    } catch (e) {
      setProposalState((p) => ({
        ...p,
        [proposal.id]: {
          kind: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        },
      }));
    }
  }

  function onReject(proposal: LearningProposal) {
    setProposalState((p) => ({ ...p, [proposal.id]: { kind: "rejected" } }));
  }

  if (loading) return <p className="text-sm text-stone-600">Loading sessions…</p>;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data) return null;

  const { stats, per_session, proposals, mocked, accepted_count } = data;

  if (stats.session_count === 0) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-600">
        No saved applications yet. Generate a cover letter on the analyzer page and
        click <strong>Save application</strong> — then come back here to see
        patterns aggregate.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {mocked && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>LLM proposals are mocked.</strong> Set <code>ANTHROPIC_API_KEY</code>{" "}
          for nuanced pattern detection beyond the deterministic aggregator.
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Sessions
          </h2>
          <StatRow label="Saved applications" value={String(stats.session_count)} />
          <StatRow label="Marked 'worked'" value={String(stats.verdict_counts.worked)} />
          <StatRow
            label="Marked 'felt off'"
            value={String(stats.verdict_counts.felt_off)}
          />
          <StatRow label="No verdict" value={String(stats.verdict_counts.unset)} />
          <StatRow
            label="Already in profile"
            value={`${accepted_count} learned`}
          />
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Avg critique scores
          </h2>
          <StatRow label="Relevance" value={fmtScore(stats.avg_scores.relevance)} />
          <StatRow label="Specificity" value={fmtScore(stats.avg_scores.specificity)} />
          <StatRow label="Honesty" value={fmtScore(stats.avg_scores.honesty)} />
          <StatRow label="Tone fit" value={fmtScore(stats.avg_scores.tone_fit)} />
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Avg edit fraction
          </h2>
          <StatRow label="Opening" value={pct(stats.avg_section_edit_fraction.opening)} />
          <StatRow
            label="Bridge paragraphs"
            value={pct(stats.avg_section_edit_fraction.bridge_avg)}
          />
          <StatRow
            label="Gap acknowledgement"
            value={pct(stats.avg_section_edit_fraction.gap_acknowledgement)}
          />
          <StatRow label="Closing" value={pct(stats.avg_section_edit_fraction.closing)} />
        </div>
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Annotation response by issue type
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-1 pr-3">Issue</th>
                <th className="py-1 pr-3 text-right">Total</th>
                <th className="py-1 pr-3 text-right">Accepted</th>
                <th className="py-1 pr-3 text-right">Rejected</th>
                <th className="py-1 pr-3 text-right">Ignored</th>
                <th className="py-1 pr-3 text-right">No response</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.annotation_stats_by_issue).map(([issue, s]) => (
                <tr key={issue} className="border-b border-stone-100">
                  <td className="py-1 pr-3 font-medium">{issue}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.total}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.accepted}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.rejected}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.ignored}</td>
                  <td className="py-1 pr-3 text-right tabular-nums">{s.no_response}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {stats.pattern_flags.length > 0 && (
        <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Pattern flags you have added
          </h2>
          <ul className="space-y-2">
            {stats.pattern_flags.map((f) => (
              <li
                key={f.text}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <span>{f.text}</span>
                <span className="shrink-0 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
                  {f.count}× across {f.session_ids.length} session(s)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Proposed learnings ({proposals.length})
        </h2>
        {proposals.length === 0 ? (
          <p className="text-sm text-stone-600">
            No new proposals. Either nothing has crossed the thresholds yet, or
            everything already proposed has been accepted.
          </p>
        ) : (
          <ul className="space-y-3">
            {proposals.map((p) => {
              const state = proposalState[p.id] ?? { kind: "pending" };
              return (
                <li
                  key={p.id}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                        p.source === "aggregator"
                          ? "bg-stone-100 text-stone-700"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {p.source}
                    </span>
                    <code className="text-xs text-stone-500">{p.id}</code>
                  </div>
                  <p className="font-medium">{p.observation}</p>
                  <p className="mt-1 text-sm text-stone-600">{p.rationale}</p>
                  <p className="mt-1 text-xs text-stone-500">
                    Evidence: {p.evidence_session_ids.join(", ") || "—"}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    {state.kind === "pending" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onAccept(p)}
                          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => onReject(p)}
                          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-stone-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {state.kind === "applying" && (
                      <span className="text-sm text-stone-500">Saving…</span>
                    )}
                    {state.kind === "accepted" && (
                      <span className="text-sm text-emerald-700">
                        Added to master profile · <code>{state.id}</code>
                      </span>
                    )}
                    {state.kind === "rejected" && (
                      <span className="text-sm text-stone-500">Dismissed</span>
                    )}
                    {state.kind === "error" && (
                      <span className="text-sm text-rose-700">
                        {state.message}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">
          Sessions
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-1 pr-3">Id</th>
                <th className="py-1 pr-3">Updated</th>
                <th className="py-1 pr-3">Verdict</th>
                <th className="py-1 pr-3 text-right">Relevance</th>
                <th className="py-1 pr-3 text-right">Specificity</th>
                <th className="py-1 pr-3 text-right">Honesty</th>
                <th className="py-1 pr-3 text-right">Tone fit</th>
                <th className="py-1 pr-3 text-right">Opening Δ</th>
                <th className="py-1 pr-3 text-right">Bridge Δ</th>
                <th className="py-1 pr-3 text-right">Closing Δ</th>
              </tr>
            </thead>
            <tbody>
              {per_session.map((s) => (
                <tr key={s.id} className="border-b border-stone-100">
                  <td className="py-1 pr-3 font-mono text-xs">{s.id}</td>
                  <td className="py-1 pr-3 text-xs">
                    {new Date(s.updated_at).toLocaleString()}
                  </td>
                  <td className="py-1 pr-3 text-xs">
                    {s.verdict ?? "—"}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {s.scores.relevance}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {s.scores.specificity}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {s.scores.honesty}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {s.scores.tone_fit}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {pct(s.section_edit_fractions.opening)}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {pct(s.section_edit_fractions.bridge_avg)}
                  </td>
                  <td className="py-1 pr-3 text-right tabular-nums">
                    {pct(s.section_edit_fractions.closing)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
