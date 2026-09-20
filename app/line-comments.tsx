"use client";

import { useMemo, useState } from "react";
import { analyzeHumanity, type TellFinding } from "@/lib/ai-tells";
import { fixesFor } from "@/lib/cv-fixes";

/**
 * House-style findings shown as comments on the line they are about.
 *
 * The editorial decision — which half of a bullet survives, whether a dash
 * becomes a full stop or a parenthesis — is one click, with the resulting line
 * shown before it is applied. A comment can also be acted on by deleting the
 * line outright, or dismissed when the writer disagrees with the rule.
 *
 * Only per-line findings appear here. Document-level ones (every bullet the same
 * length, a repeated opening word) belong to the whole CV, not to one line, and
 * stay in the summary panel.
 */
export default function LineComments({
  lines,
  onChange,
  onDelete,
  kind = "bullets",
}: {
  lines: string[];
  /** Replace line `index` with `text`. */
  onChange: (index: number, text: string) => void;
  /** Remove line `index` entirely. Omitted where deletion makes no sense. */
  onDelete?: (index: number) => void;
  kind?: "bullets" | "summary";
}) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  const findings = useMemo(() => {
    const present = lines.map((l) => l.trim());
    const report = analyzeHumanity({
      segments: present,
      kind: "cv",
      summaryIndex: kind === "summary" ? 0 : null,
    });
    // Line-level only; the key survives edits to other lines.
    return report.findings
      .filter((f) => f.segment_index >= 0)
      .map((f) => ({ finding: f, key: `${f.rule_id}:${f.segment_index}:${f.excerpt.slice(0, 40)}` }));
  }, [lines, kind]);

  const visible = findings.filter(({ key }) => !dismissed.has(key));
  if (visible.length === 0) return null;

  return (
    <ul className="mt-2 space-y-1.5">
      {visible.map(({ finding, key }) => (
        <Comment
          key={key}
          finding={finding}
          line={lines[finding.segment_index] ?? ""}
          lineNumber={finding.segment_index}
          open={expanded === key}
          showLineNumber={kind === "bullets" && lines.length > 1}
          onToggle={() => setExpanded(expanded === key ? null : key)}
          onApply={(text) => {
            onChange(finding.segment_index, text);
            setExpanded(null);
          }}
          onDelete={
            onDelete
              ? () => {
                  onDelete(finding.segment_index);
                  setExpanded(null);
                }
              : undefined
          }
          onDismiss={() => setDismissed(new Set([...dismissed, key]))}
        />
      ))}
    </ul>
  );
}

function Comment({
  finding,
  line,
  lineNumber,
  open,
  showLineNumber,
  onToggle,
  onApply,
  onDelete,
  onDismiss,
}: {
  finding: TellFinding;
  line: string;
  lineNumber: number;
  open: boolean;
  showLineNumber: boolean;
  onToggle: () => void;
  onApply: (text: string) => void;
  onDelete?: () => void;
  onDismiss: () => void;
}) {
  const fixes = useMemo(() => fixesFor(finding, line), [finding, line]);
  const tone =
    finding.severity === "strong"
      ? "border-rose-200 bg-rose-50"
      : "border-amber-200 bg-amber-50";

  return (
    <li className={`rounded-md border ${tone}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-baseline gap-2 px-2 py-1.5 text-left text-xs"
      >
        <span className="font-medium">{finding.label}</span>
        {showLineNumber && (
          <span className="rounded bg-white/70 px-1.5 py-0.5 text-[11px] text-stone-600">
            line {lineNumber + 1}
          </span>
        )}
        <span className="truncate text-stone-600">{line}</span>
        <span className="ml-auto shrink-0 text-stone-500">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-white/70 px-2 py-2 text-xs">
          <p>{finding.why}</p>

          {fixes.length > 0 ? (
            <div className="space-y-1.5">
              {fixes.map((fix) => (
                <div key={fix.label} className="rounded border border-white/80 bg-white/70 p-1.5">
                  <div className="leading-relaxed text-stone-800">{fix.result}</div>
                  <button
                    type="button"
                    onClick={() => onApply(fix.result)}
                    className="mt-1 rounded border border-stone-300 bg-white px-2 py-0.5 text-[11px] font-medium hover:bg-stone-100"
                  >
                    {fix.label}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-stone-600">
              {finding.suggestion ?? "This one needs a judgement call — edit it above."}
            </p>
          )}

          <div className="flex flex-wrap gap-3 pt-0.5">
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="font-medium text-rose-700 underline-offset-2 hover:underline"
              >
                Delete this line
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className="text-stone-600 underline-offset-2 hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
