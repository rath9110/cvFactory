"use client";

import { useState } from "react";
import type { LearningProposal } from "@/lib/profile-types";

export type RefreshResult = {
  proposals: LearningProposal[];
  mocked: boolean;
  generated_at: string | null;
  stale: boolean;
};

/**
 * Proposals are worked out when a piece of work finishes — a download, a save,
 * or the tab closing — not when this page is opened. So the page has to say how
 * current they are, and offer a way to ask for them right now.
 *
 * The button is disabled when nothing has changed since the last run, because
 * in that state a refresh would return the same proposals without calling the
 * model anyway.
 */
export default function FreshnessBar({
  generatedAt,
  stale,
  onRefreshed,
}: {
  generatedAt: string | null;
  stale: boolean;
  onRefreshed: (next: RefreshResult) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/learn/refresh", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? `Refresh failed (${res.status})`);
      } else {
        onRefreshed({
          proposals: body.proposals ?? [],
          mocked: Boolean(body.mocked),
          generated_at: body.generated_at ?? null,
          stale: false,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setRefreshing(false);
    }
  }

  const upToDate = !stale && Boolean(generatedAt);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-xs">
      <span className="text-stone-600">
        {generatedAt
          ? `Proposals last worked out ${new Date(generatedAt).toLocaleString()}`
          : "Proposals have not been worked out yet."}
        {stale && (
          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900">
            out of date
          </span>
        )}
      </span>
      <span className="flex items-center gap-3">
        {error && <span className="text-rose-700">{error}</span>}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing || upToDate}
          className="rounded-md border border-stone-300 bg-white px-3 py-1.5 font-medium hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Working…" : upToDate ? "Up to date" : "Work them out now"}
        </button>
      </span>
    </div>
  );
}
