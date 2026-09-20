"use client";

import { useState } from "react";
import type { FeedbackBlock, StrategicBrief } from "@/lib/profile-types";
import type { CVPayload } from "./cv-view";
import { triggerLearningRefresh } from "@/lib/learning-trigger";

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: string }
  | { kind: "error"; message: string };

/**
 * Saves the application as a reference to learn from later.
 *
 * Lives at page level rather than inside a draft section, so a CV can be saved
 * on its own — the cover letter's fields on ApplicationSession are optional.
 */
export default function SaveApplication({
  jobAd,
  brief,
  getCVPayload,
}: {
  jobAd: string;
  brief: StrategicBrief | null;
  getCVPayload: () => CVPayload | null;
}) {
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const payload = getCVPayload();
  const ready = Boolean(brief) && Boolean(payload);

  async function onSave() {
    const cv = getCVPayload();
    if (!brief || !cv) return;
    setState({ kind: "saving" });

    const feedback: FeedbackBlock = {
      overall_verdict: null,
      overall_comment: "",
      annotation_responses: [],
      section_comments: { opening: "", bridge: [], gap_acknowledgement: "", closing: "" },
      pattern_flags: [],
      cv_notes: cv.notes,
    };

    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: applicationId ?? undefined,
          job_ad: jobAd,
          brief,
          feedback,
          cv_variant: cv.variant,
          cv_critique: cv.critique,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setApplicationId(data.id);
      // Saving as a reference is one of the moments the learning pass runs.
      triggerLearningRefresh();
      setState({ kind: "saved", at: new Date(data.updated_at).toLocaleTimeString() });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        onClick={onSave}
        disabled={!ready || state.kind === "saving"}
        className="border border-stone-900 bg-stone-900 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-white hover:text-stone-900 disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-300 disabled:text-white"
      >
        {state.kind === "saving"
          ? "Saving…"
          : applicationId
            ? "Save changes"
            : "Save as reference"}
      </button>

      <span className="text-xs text-stone-500">
        {!ready
          ? "Generate a CV first — saved applications are what the learning page reads."
          : "Keeps this CV, your notes and the job ad so future drafts can learn from them."}
      </span>

      {state.kind === "saved" && (
        <span className="text-xs text-emerald-700">
          Saved at {state.at}
          {applicationId && (
            <>
              {" · "}
              <a
                href={`/applications/${applicationId}`}
                className="underline underline-offset-2"
              >
                open
              </a>
            </>
          )}
        </span>
      )}
      {state.kind === "error" && (
        <span className="text-xs text-rose-700">{state.message}</span>
      )}
    </div>
  );
}
