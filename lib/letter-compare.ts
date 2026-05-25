import { editFraction } from "./diff";
import { CoverLetter, CritiqueScores } from "./profile-types";

export type LetterSectionDelta = {
  opening: number;
  bridge_avg: number;
  gap_acknowledgement: number;
  closing: number;
};

export function letterSectionDeltas(
  baseline: CoverLetter,
  next: CoverLetter
): LetterSectionDelta {
  const opening = editFraction(baseline.opening, next.opening);
  const gap = editFraction(
    baseline.gap_acknowledgement ?? "",
    next.gap_acknowledgement ?? ""
  );
  const closing = editFraction(baseline.closing, next.closing);

  const maxBridge = Math.max(baseline.bridge.length, next.bridge.length);
  const bridgeFracs: number[] = [];
  for (let i = 0; i < maxBridge; i += 1) {
    const a = baseline.bridge[i]?.text ?? "";
    const b = next.bridge[i]?.text ?? "";
    bridgeFracs.push(editFraction(a, b));
  }
  const bridgeAvg =
    bridgeFracs.length === 0
      ? 0
      : bridgeFracs.reduce((s, v) => s + v, 0) / bridgeFracs.length;

  return {
    opening,
    bridge_avg: bridgeAvg,
    gap_acknowledgement: gap,
    closing,
  };
}

export type ScoreDelta = {
  relevance: number;
  specificity: number;
  honesty: number;
  tone_fit: number;
};

export function scoreDeltas(
  baseline: CritiqueScores,
  next: CritiqueScores
): ScoreDelta {
  return {
    relevance: next.relevance - baseline.relevance,
    specificity: next.specificity - baseline.specificity,
    honesty: next.honesty - baseline.honesty,
    tone_fit: next.tone_fit - baseline.tone_fit,
  };
}

export type StringDelta = "unchanged" | "added" | "removed";

export function stringListDelta(
  baseline: string[],
  next: string[]
): { text: string; status: StringDelta }[] {
  const baseSet = new Set(baseline.map((s) => s.toLowerCase().trim()));
  const nextSet = new Set(next.map((s) => s.toLowerCase().trim()));
  const merged: { text: string; status: StringDelta }[] = [];
  for (const item of baseline) {
    const key = item.toLowerCase().trim();
    merged.push({
      text: item,
      status: nextSet.has(key) ? "unchanged" : "removed",
    });
  }
  for (const item of next) {
    const key = item.toLowerCase().trim();
    if (!baseSet.has(key)) merged.push({ text: item, status: "added" });
  }
  return merged;
}
