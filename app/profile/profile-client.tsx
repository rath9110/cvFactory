"use client";

import { useEffect, useState } from "react";
import type { LearnedPreference, MasterProfile } from "@/lib/profile-types";

type ProfileResponse = { profile: MasterProfile };

type RevertState =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "done"; at: string }
  | { kind: "error"; message: string };

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-stone-600">{label}</span>
      <span className="tabular-nums font-medium">{value}</span>
    </div>
  );
}

function ConfidenceBadge({ confidence }: { confidence: "proposed" | "confirmed" }) {
  if (confidence === "confirmed") {
    return (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800">
        confirmed
      </span>
    );
  }
  return (
    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
      proposed
    </span>
  );
}

export default function ProfileClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const [revertState, setRevertState] = useState<Record<string, RevertState>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", { method: "GET" });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? `HTTP ${res.status}`);
      else setProfile((data as ProfileResponse).profile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onRevert(learning: LearnedPreference) {
    if (
      !confirm(
        `Revert this learning?\n\n"${learning.observation}"\n\nIt will be removed from your master profile and may reappear as a proposal on the Learning page.`
      )
    )
      return;
    setRevertState((s) => ({ ...s, [learning.id]: { kind: "pending" } }));
    try {
      const res = await fetch("/api/profile/revert-learning", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ learning_id: learning.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRevertState((s) => ({
          ...s,
          [learning.id]: { kind: "error", message: data.error ?? `HTTP ${res.status}` },
        }));
        return;
      }
      setRevertState((s) => ({
        ...s,
        [learning.id]: { kind: "done", at: new Date().toLocaleTimeString() },
      }));
      await load();
    } catch (e) {
      setRevertState((s) => ({
        ...s,
        [learning.id]: {
          kind: "error",
          message: e instanceof Error ? e.message : "Unknown error",
        },
      }));
    }
  }

  if (loading) return <p className="text-sm text-stone-600">Loading…</p>;
  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!profile) return null;

  const sortedLearnings = [...profile.learned_preferences].sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            {profile.name}
          </h2>
          <p className="text-sm leading-relaxed text-stone-800">{profile.headline}</p>
          <p className="mt-3 text-xs text-stone-600">{profile.profile_summary}</p>
        </div>
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Profile content
          </h2>
          <StatRow label="Experience blocks" value={profile.experience_blocks.length} />
          <StatRow label="Proof points" value={profile.proof_library.length} />
          <StatRow label="Tone rules" value={profile.tone_rules.length} />
          <StatRow
            label="Positioning tensions"
            value={profile.positioning_tensions.length}
          />
          <StatRow label="Education entries" value={profile.education.length} />
          <StatRow label="Certifications" value={profile.certifications.length} />
          <StatRow label="Skill categories" value={profile.skills_taxonomy.length} />
          <StatRow
            label="Learned preferences"
            value={profile.learned_preferences.length}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">
            Learned preferences ({profile.learned_preferences.length})
          </h2>
          <p className="text-xs text-stone-600">
            Every entry below is in the system prompt of every generation. Reverting
            removes the entry from <code>master_profile.json</code> — it does not
            change past saved applications, only future generations.
          </p>
        </div>

        {sortedLearnings.length === 0 ? (
          <div className="rounded-lg border border-stone-200 bg-white p-4 text-sm text-stone-600">
            None yet. Accept proposals on the{" "}
            <a
              href="/learn"
              className="font-medium underline underline-offset-2"
            >
              Learning
            </a>{" "}
            page to add them.
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedLearnings.map((lp) => {
              const state = revertState[lp.id] ?? { kind: "idle" };
              return (
                <li
                  key={lp.id}
                  className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <ConfidenceBadge confidence={lp.confidence} />
                    <code className="text-xs text-stone-400">{lp.id}</code>
                    <span className="text-xs text-stone-500">
                      {new Date(lp.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-medium">{lp.observation}</p>
                  {lp.source_application_ids.length > 0 && (
                    <p className="mt-1 text-xs text-stone-500">
                      Source sessions: {lp.source_application_ids.join(", ")}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-2">
                    {state.kind === "idle" && (
                      <button
                        type="button"
                        onClick={() => onRevert(lp)}
                        className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50"
                      >
                        Revert
                      </button>
                    )}
                    {state.kind === "pending" && (
                      <span className="text-sm text-stone-500">Reverting…</span>
                    )}
                    {state.kind === "done" && (
                      <span className="text-sm text-emerald-700">
                        Reverted at {state.at}
                      </span>
                    )}
                    {state.kind === "error" && (
                      <span className="text-sm text-rose-700">{state.message}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Active tone rules ({profile.tone_rules.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {profile.tone_rules.map((r) => (
              <li key={r.id} className="rounded border border-stone-200 bg-stone-50 p-2">
                <p className="font-medium">{r.rule}</p>
                {r.rationale && (
                  <p className="mt-1 text-xs text-stone-600">{r.rationale}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Positioning tensions ({profile.positioning_tensions.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {profile.positioning_tensions.map((t) => (
              <li key={t.id} className="rounded border border-stone-200 bg-stone-50 p-2">
                <p className="font-medium">{t.tension}</p>
                <p className="mt-1 text-xs text-stone-600">
                  <span className="font-semibold">Default:</span> {t.default_lean}
                </p>
                <p className="text-xs text-stone-600">
                  <span className="font-semibold">Flip when:</span> {t.when_to_flip}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
