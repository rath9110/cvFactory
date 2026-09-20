"use client";

import { useCallback, useRef, useState } from "react";
import type { StrategicBrief } from "@/lib/profile-types";
import CVView, { type CVPayload } from "./cv-view";
import SaveApplication from "./save-application";
import StrategyDetails from "./strategy-details";

type AnalyzeResponse = {
  brief: StrategicBrief;
  mocked: boolean;
  profileName: string;
};

export default function AnalyzerClient() {
  const [jobAd, setJobAd] = useState("");
  const [brief, setBrief] = useState<StrategicBrief | null>(null);
  const [mocked, setMocked] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // Bumped whenever the CV changes, so the save button can tell whether there
  // is anything to save without re-rendering the editor on every keystroke.
  const [cvRevision, setCvRevision] = useState(0);
  const cvPayloadRef = useRef<CVPayload | null>(null);
  const onCVPayloadChange = useCallback((p: CVPayload | null) => {
    const had = cvPayloadRef.current !== null;
    cvPayloadRef.current = p;
    if (had !== (p !== null)) setCvRevision((n) => n + 1);
  }, []);
  const getCVPayload = useCallback(() => cvPayloadRef.current, []);

  /**
   * The job ad is analysed on the way to generating something, not as a step the
   * user has to take. The result is cached against the exact job-ad text, so
   * generating a CV and then a cover letter costs one analysis, while editing the
   * job ad invalidates it. Concurrent callers share the same in-flight request.
   */
  const inFlight = useRef<{ jobAd: string; promise: Promise<StrategicBrief> } | null>(null);

  const getBrief = useCallback(async (): Promise<StrategicBrief> => {
    const trimmed = jobAd.trim();
    const cached = inFlight.current;
    if (cached && cached.jobAd === trimmed) return cached.promise;

    setAnalyzing(true);
    const promise = (async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ jobAd: trimmed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `Could not read the job ad (${res.status})`);
        const parsed = data as AnalyzeResponse;
        setBrief(parsed.brief);
        setMocked(Boolean(parsed.mocked));
        return parsed.brief;
      } finally {
        setAnalyzing(false);
      }
    })();

    inFlight.current = { jobAd: trimmed, promise };
    // A failed analysis must not be cached, or the retry would return the error.
    promise.catch(() => {
      if (inFlight.current?.promise === promise) inFlight.current = null;
    });
    return promise;
  }, [jobAd]);

  const ready = jobAd.trim().length >= 20;

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <label htmlFor="jobAd" className="block text-sm font-medium">
          Job ad
        </label>
        <textarea
          id="jobAd"
          value={jobAd}
          onChange={(e) => setJobAd(e.target.value)}
          rows={10}
          placeholder="Paste the full job ad here, then generate a CV or a cover letter…"
          className="w-full rounded-md border border-stone-300 bg-white p-3 font-mono text-sm shadow-sm focus:border-stone-500 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-3 text-xs text-stone-500">
          {!ready && <span>Paste a job ad to get started.</span>}
          {ready && analyzing && <span>Reading the job ad…</span>}
          {mocked && (
            <span className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900">
              Sample output — set <code>ANTHROPIC_API_KEY</code> in{" "}
              <code>.env.local</code> for real drafts.
            </span>
          )}
        </div>
      </section>

      {ready && (
        <>
          <CVView getBrief={getBrief} onPayloadChange={onCVPayloadChange} />

          <SaveApplication
            key={cvRevision}
            jobAd={jobAd}
            brief={brief}
            getCVPayload={getCVPayload}
          />

          <StrategyDetails brief={brief} />

          <p className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-sm text-stone-600">
            <strong className="font-medium text-stone-800">Cover letters are coming later.</strong>{" "}
            The generator, its self-critique and the feedback capture are all still
            in the codebase — they are just not wired into this page while the CV
            is the focus.
          </p>
        </>
      )}
    </div>
  );
}
