import type { TellFinding } from "./ai-tells.ts";

/**
 * Turns a finding into concrete replacement text.
 *
 * A suggestion the reader has to carry out by hand is barely a suggestion, so
 * where a rule has a mechanical repair this computes it and hands back the
 * finished line. Every fix here only ever removes or rearranges what is already
 * in the bullet — none of them introduce a word the bullet did not contain, so
 * nothing can smuggle in a fact or a figure.
 *
 * Rules needing judgement (an adjective string, an abstract noun, a bullet that
 * simply has no evidence in it) return no fix. Those are left to the writer.
 */

export type Fix = {
  /** What the button says. */
  label: string;
  /** The bullet as it would read afterwards. */
  result: string;
};

const DASH = /\s*[—–]\s*/;
const DASH_GLOBAL = /\s*[—–]\s*/g;

function capitalise(text: string): string {
  const t = text.trim();
  return t.length === 0 ? t : t[0].toUpperCase() + t.slice(1);
}

function tidy(text: string): string {
  return text
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*\./g, ".")
    .trim();
}

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Joins that mean a bullet is carrying two ideas, longest first so ", and " wins over ". */
const TWO_IDEA_JOINS = [
  " in addition to ",
  " as well as ",
  " while also ",
  ", and ",
  "; ",
];

function emDashFixes(text: string): Fix[] {
  const parts = text.split(DASH_GLOBAL).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return [];

  const fixes: Fix[] = [];

  // A pair of dashes usually wraps an aside, which parentheses hold better.
  if (parts.length === 3) {
    fixes.push({
      label: "Parentheses",
      result: tidy(`${parts[0]} (${parts[1]}) ${parts[2]}`),
    });
  }

  fixes.push({
    label: "Full stop",
    result: tidy(parts.map((p, i) => (i === 0 ? p : capitalise(p))).join(". ")) + ".",
  });

  fixes.push({ label: "Comma", result: tidy(parts.join(", ")) });

  return fixes;
}

function twoIdeaFixes(text: string): Fix[] {
  const lower = text.toLowerCase();
  const join = TWO_IDEA_JOINS.find((j) => lower.includes(j));
  if (!join) return [];

  const at = lower.indexOf(join);
  const first = tidy(text.slice(0, at)).replace(/[,;]$/, "");
  const second = capitalise(tidy(text.slice(at + join.length)));
  if (!first || !second) return [];

  return [
    { label: "Keep the first half", result: first },
    { label: "Keep the second half", result: second },
  ];
}

function removeWordFix(text: string, word: string, label: string): Fix[] {
  const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!re.test(text)) return [];
  const result = capitalise(tidy(text.replace(re, "")));
  return result.length > 0 && result !== text ? [{ label, result }] : [];
}

/** The offending phrase, recovered from the finding's own explanation. */
function quotedTerm(finding: TellFinding): string | null {
  const match = finding.why.match(/"([^"]+)"/) ?? finding.suggestion?.match(/"([^"]+)"/);
  return match ? match[1] : null;
}

export function fixesFor(finding: TellFinding, text: string): Fix[] {
  switch (finding.rule_id) {
    case "em_dash":
      return emDashFixes(text);

    case "two_ideas":
      return twoIdeaFixes(text);

    case "bullet_too_long": {
      const parts = sentencesOf(text);
      if (parts.length >= 2) {
        return [{ label: "Keep the first sentence", result: parts[0] }];
      }
      return twoIdeaFixes(text);
    }

    case "pronoun_in_bullet": {
      const pronoun = quotedTerm(finding);
      return pronoun ? removeWordFix(text, pronoun, `Remove "${pronoun}"`) : [];
    }

    case "empty_intensifier":
    case "unquantified_scale": {
      const word = quotedTerm(finding);
      return word ? removeWordFix(text, word, `Remove "${word}"`) : [];
    }

    case "weak_attribution":
    case "filler_verb":
    case "consultant_verb":
    case "stock_phrase":
    case "nominalisation":
      // The phrase can be cut mechanically, but what replaces it is a writing
      // decision — the verb usually has to change with it.
      return [];

    default:
      return [];
  }
}
