"use client";

import { useState } from "react";
import type { Requirement, StrategicBrief } from "@/lib/profile-types";

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

/**
 * The strategic brief: the reasoning the drafts were built from.
 *
 * Collapsed by default. It is the system's working-out, not the user's
 * deliverable — useful when a draft looks wrong and you want to know why, and
 * noise the rest of the time.
 */
export default function StrategyDetails({ brief }: { brief: StrategicBrief | null }) {
  const [open, setOpen] = useState(false);

  if (!brief) return null;

  const gaps = brief.requirements.filter((r) => r.match_status === "gap").length;

  return (
    <section className="rounded-lg border border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <span>
          <span className="text-sm font-semibold">Why these drafts say what they say</span>
          <span className="mt-0.5 block text-xs text-stone-500">
            {brief.requirements.length} requirements read from the ad
            {gaps > 0 ? `, ${gaps} flagged as a genuine gap` : ""} ·{" "}
            {brief.lead_with.length} angles to lead with
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-stone-500">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="space-y-5 border-t border-stone-200 p-4">
          <Block title="Job summary">
            <p className="text-sm leading-relaxed">{brief.job_summary}</p>
          </Block>

          <Block title="Positioning">
            <p className="text-sm leading-relaxed">{brief.positioning_memo}</p>
          </Block>

          <div className="grid gap-4 md:grid-cols-2">
            <Block title="Leading with">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {brief.lead_with.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </Block>
            <Block title="Not claiming">
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {brief.do_not_fake.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </Block>
          </div>

          {brief.reframe.length > 0 && (
            <Block title="Reframed">
              <ul className="space-y-2 text-sm">
                {brief.reframe.map((r, i) => (
                  <li key={i} className="rounded border border-stone-200 bg-stone-50 p-2">
                    <span className="text-stone-500">{r.from}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">{r.to}</span>
                  </li>
                ))}
              </ul>
            </Block>
          )}

          <Block title="Requirements">
            <ul className="space-y-2">
              {brief.requirements.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-md border p-3 text-sm ${STATUS_STYLES[r.match_status]}`}
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
                    <span className="rounded bg-white/60 px-1.5 py-0.5">
                      {KIND_LABEL[r.kind]}
                    </span>
                    <span className="rounded bg-white/60 px-1.5 py-0.5">
                      {STATUS_LABEL[r.match_status]}
                    </span>
                  </div>
                  <p className="mt-2 font-medium">{r.text}</p>
                  <p className="mt-1 opacity-90">{r.reasoning}</p>
                </li>
              ))}
            </ul>
          </Block>
        </div>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
        {title}
      </h3>
      {children}
    </div>
  );
}
