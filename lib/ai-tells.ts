// The .ts extension is required so Node can run tests/ai-tells.test.ts directly;
// the bundler resolves it the same way. VoiceMetrics is imported as `import type`
// because type-stripping cannot otherwise tell a type from a real export.
import { computeMetrics, sentences, words } from "./voice-metrics.ts";
import type { VoiceMetrics } from "./voice-metrics.ts";

/**
 * Deterministic detector for writing that reads as machine-generated.
 *
 * Deliberately NOT a personal-voice matcher. It does not know or care how any
 * particular person writes; it looks for the markers that separate generated
 * application text from the real thing — stock phrases, claims of scale with no
 * figure attached, weak attribution, and mechanical uniformity.
 *
 * Every rule is a plain string or arithmetic check: no model call, no cost, and
 * the same text always produces the same findings. That makes it safe to run on
 * every keystroke in the browser, and usable as a measuring stick for whether a
 * future prompt change actually helped.
 *
 * Precision over coverage. A false positive trains the user to ignore the panel,
 * so a rule is only included when a real CV bullet would rarely trip it.
 */

export type TellSeverity = "strong" | "weak";

export type TellFinding = {
  rule_id: string;
  label: string;
  severity: TellSeverity;
  /** Plain-language reason this reads as machine-written. */
  why: string;
  /** The offending text, verbatim, so the UI can locate and highlight it. */
  excerpt: string;
  /** Which segment it came from: a CV bullet, or a letter paragraph. */
  segment_index: number;
  suggestion?: string;
};

export type HumanityReport = {
  findings: TellFinding[];
  /** Rough 0–100 index. The findings are the substance; this is a headline. */
  score: number;
  band: "reads human" | "a few tells" | "reads machine-written";
  strong_count: number;
  weak_count: number;
  metrics: VoiceMetrics;
};

// ------------------------------------------------------------ phrase rules

type PhraseRule = {
  rule_id: string;
  label: string;
  severity: TellSeverity;
  why: string;
  suggestion?: string;
  phrases: string[];
};

const PHRASE_RULES: PhraseRule[] = [
  {
    rule_id: "stock_phrase",
    label: "Stock phrase",
    severity: "strong",
    why: "This phrase appears in millions of applications. A reader's eye slides straight past it.",
    suggestion: "Replace it with the specific thing you actually did.",
    phrases: [
      "proven track record", "results-driven", "results driven", "detail-oriented",
      "detail oriented", "team player", "go-getter", "value add", "value-add",
      "game changer", "game-changer", "best-in-class", "best in class",
      "world-class", "world class", "cutting-edge", "cutting edge",
      "state-of-the-art", "state of the art", "hit the ground running",
      "think outside the box", "dynamic environment", "fast-paced environment",
      "wealth of experience", "passion for excellence", "diverse range",
      "wide range of", "deep dive", "move the needle", "low-hanging fruit",
    ],
  },
  {
    rule_id: "consultant_verb",
    label: "Inflated verb",
    severity: "strong",
    why: "Verbs like this are chosen to sound impressive rather than to describe the work. Plain verbs read as more credible, not less.",
    suggestion: "Use the ordinary verb: led, ran, built, moved, cut, wrote.",
    phrases: [
      "spearheaded", "championed", "orchestrated", "synergy", "synergies",
      "synergistic", "leverage", "leveraged", "leveraging", "utilize", "utilized",
      "utilizing", "utilisation", "utilization", "ideated", "actioned",
      "operationalized", "operationalised", "evangelized", "evangelised",
      "seasoned", "dynamic", "holistic", "robust", "deep dive", "journey",
      "passionate", "results-driven", "results driven",
    ],
  },
  {
    rule_id: "enthusiasm_opener",
    label: "Template opening",
    severity: "strong",
    why: "The most recognisable generated-application opening there is. It says nothing about the company or the job.",
    suggestion: "Open with the specific thing about this role or company that made you apply.",
    phrases: [
      "i am writing to express", "i am writing to apply", "i am excited to apply",
      "i am thrilled to apply", "i would like to express my interest",
      "i am passionate about", "passionate about", "thrilled to", "delighted to",
      "excited about the opportunity", "in today's fast-paced", "in today's",
      "in an era where", "as a seasoned",
    ],
  },
  {
    rule_id: "not_just_construction",
    label: "\"Not just X, but Y\"",
    severity: "strong",
    why: "A rhetorical shape language models fall into constantly. Once you notice it, you can't unsee it.",
    suggestion: "State the point directly, without the setup.",
    phrases: [
      "not just", "not only", "more than just", "isn't just", "is not just",
      "it's not about", "it is not about",
    ],
  },
  {
    rule_id: "weak_attribution",
    label: "Hedge",
    severity: "strong",
    why: "Distances you from your own work. If you owned it, say so. If you didn't, name what you actually did.",
    suggestion: "Claim the action plainly, or name your specific part in it.",
    phrases: [
      "helped to", "helped support", "assisted with", "was involved in",
      "involved in", "played a key role", "played a crucial role",
      "played an important role", "contributed to", "worked to ensure",
      "was responsible for helping", "had the opportunity to", "was fortunate to",
      "part of the team that", "was part of", "supported the delivery of",
      "took part in",
    ],
  },
  {
    rule_id: "filler_verb",
    label: "Filler wrapped around a verb",
    severity: "strong",
    why: "A real verb is buried inside a noun phrase. \"Responsible for the coordination of\" is just \"Coordinated\".",
    suggestion: "Cut to the verb.",
    phrases: [
      "responsible for the", "responsible for", "tasked with", "duties included",
      "in charge of the", "accountable for the", "the coordination of",
      "the management of", "oversaw the management",
    ],
  },
  {
    rule_id: "adjective_string",
    label: "Adjective string",
    severity: "strong",
    why: "\"Strategic, analytical and collaborative\" says nothing about you. Pick one, or show it in a bullet instead.",
    suggestion: "Cut all three and let a bullet demonstrate it.",
    phrases: [],
  },
  {
    rule_id: "nominalisation",
    label: "Noun-heavy phrasing",
    severity: "weak",
    why: "Turning a verb into a noun drains the sentence. \"The implementation of X\" is slower than \"implemented X\".",
    suggestion: "Use the verb form.",
    phrases: [
      "the implementation of", "the optimization of", "the optimisation of",
      "the utilization of", "the utilisation of", "the delivery of the",
      "the execution of", "the facilitation of", "the enhancement of",
      "the development and implementation",
    ],
  },
];

/** Vague magnitude words. Only a tell when no actual figure backs them up. */
const VAGUE_SCALE = [
  "significantly", "substantially", "dramatically", "greatly", "considerably",
  "markedly", "numerous", "various", "multiple", "several", "countless", "myriad",
  "extensive", "vast", "tremendous",
];

const EMPTY_INTENSIFIERS = [
  "very", "extremely", "incredibly", "hugely", "truly", "deeply", "absolutely",
  "utterly", "immensely", "tremendously", "highly",
];

const NUMBER_IN_TEXT = /\d/;

/** Em and en dashes. Banned outright in a CV, not merely rationed. */
const DASH_RE = /[—–]/;

/**
 * Abstract nouns that make a profile summary true of anyone. Checked only in the
 * summary, where they do the damage — "impact" inside a bullet with a figure
 * attached is a different thing.
 */
const ABSTRACT_NOUNS = [
  "future", "meaning", "change", "balance", "opportunities", "impact",
  "excellence", "growth mindset", "passion", "journey", "value", "vision",
  "potential", "synergy",
];

/** Openers that delay the point. */
const WARM_UP_OPENERS = [
  "experienced professional", "seasoned professional", "highly motivated",
  "results-oriented", "a strong background in", "with a strong background",
  "with a proven track record", "dedicated professional", "accomplished professional",
];

/** Words a CV bullet has no business containing. */
const BULLET_PRONOUNS = /\b(i|my|me|we|our|us)\b/i;

/** Openers that mean the bullet is not starting with a past-tense verb. */
const NON_VERB_OPENERS = new Set([
  "responsible", "accountable", "key", "successful", "successfully", "strong",
  "the", "a", "an", "this", "acting", "working", "helping", "supporting",
  "managing", "leading", "driving", "delivering", "building", "owning",
]);

/** Joins that usually mean two separate bullets got merged into one. */
const TWO_IDEA_JOINS = [
  ", and ", "; ", " while also ", " in addition to ", " as well as ",
];

/** Two rendered lines at the template's geometry. */
const MAX_BULLET_CHARS = 180;

/**
 * "Strategic, analytical and collaborative" — three adjectives in a row.
 * Lower-case only, so a list of proper nouns ("SQL, Python and dbt") is not
 * mistaken for one, and at least two of the three must look like adjectives.
 */
// No trailing -y: it matches far more business nouns (privacy, policy, delivery,
// company) than adjectives, and a list of departments is not an adjective string.
const ADJECTIVE_SUFFIX = /(ic|al|ive|ent|ant|ous|ful|able|ible)$/;

function adjectiveStringIn(sentence: string): string | null {
  const match = sentence.match(/\b([a-z]{4,}), ([a-z]{4,})(?:,)? and ([a-z]{4,})\b/);
  if (!match) return null;
  const words = [match[1], match[2], match[3]];
  const adjectiveish = words.filter((w) => ADJECTIVE_SUFFIX.test(w)).length;
  return adjectiveish === 3 ? match[0] : null;
}

// ------------------------------------------------------------ helpers

/**
 * Fixed phrases where a banned word is domain vocabulary rather than padding.
 * "customer journey" is what the industry calls the thing; "my journey" is not.
 */
const DOMAIN_EXCEPTIONS = [
  "customer journey",
  "user journey",
  "journey mapping",
  "dynamic pricing",
  "dynamic content",
];

function inDomainException(lower: string, phrase: string): boolean {
  return DOMAIN_EXCEPTIONS.some(
    (exception) => exception.includes(phrase) && lower.includes(exception)
  );
}

function phraseRegex(phrase: string): RegExp {
  return new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
}

/** Returns the sentence a match sits in, so the UI can show useful context. */
function excerptFor(sentence: string, match: string): string {
  const trimmed = sentence.trim();
  return trimmed.length <= 160 ? trimmed : match;
}

// ------------------------------------------------------------ the analysis

export type HumanityInput = {
  /** CV bullets, or letter paragraphs — one entry each. */
  segments: string[];
  kind: "cv" | "letter";
  /**
   * Which segment is the profile summary, if any. Summary-only rules (abstract
   * nouns, warm-up openers) apply there and nowhere else. Defaults to 0 for a
   * CV because cvSegments() puts the summary first; pass null when handing in
   * bare bullets, or those rules fire on the wrong text.
   */
  summaryIndex?: number | null;
};

export function analyzeHumanity({
  segments,
  kind,
  summaryIndex = kind === "cv" ? 0 : null,
}: HumanityInput): HumanityReport {
  const cleaned = segments.map((s) => (s ?? "").trim()).filter((s) => s.length > 0);
  const fullText = cleaned.join("\n");
  const findings: TellFinding[] = [];

  // ---- sentence-level rules
  cleaned.forEach((segment, segmentIndex) => {
    const segmentSentences = sentences(segment);

    for (const sentence of segmentSentences) {
      const lower = sentence.toLowerCase().replace(/['’]/g, "'");

      for (const rule of PHRASE_RULES) {
        for (const phrase of rule.phrases) {
          const match = lower.match(phraseRegex(phrase));
          if (!match) continue;
          if (inDomainException(lower, phrase)) continue;
          findings.push({
            rule_id: rule.rule_id,
            label: rule.label,
            severity: rule.severity,
            why: rule.why,
            suggestion: rule.suggestion,
            excerpt: excerptFor(sentence, match[0]),
            segment_index: segmentIndex,
          });
          break; // One finding per rule per sentence — don't pile on.
        }
      }

      // Scale claimed without a figure to back it. Weak, not strong: plenty of
      // people write this way. It is a specificity weakness, not proof of a machine.
      if (!NUMBER_IN_TEXT.test(sentence)) {
        const vague = VAGUE_SCALE.find((w) => phraseRegex(w).test(lower));
        if (vague) {
          findings.push({
            rule_id: "unquantified_scale",
            label: "Scale with no figure",
            severity: "weak",
            why: `"${vague}" claims size without saying how much. A reader can't picture it, and can't check it.`,
            suggestion: "Give the actual number, or drop the word.",
            excerpt: excerptFor(sentence, vague),
            segment_index: segmentIndex,
          });
        }
      }

      const adjectives = adjectiveStringIn(lower);
      if (adjectives) {
        const rule = PHRASE_RULES.find((r) => r.rule_id === "adjective_string")!;
        findings.push({
          rule_id: rule.rule_id,
          label: rule.label,
          severity: rule.severity,
          why: rule.why,
          suggestion: rule.suggestion,
          excerpt: adjectives,
          segment_index: segmentIndex,
        });
      }

      const intensifier = EMPTY_INTENSIFIERS.find((w) => phraseRegex(w).test(lower));
      if (intensifier) {
        findings.push({
          rule_id: "empty_intensifier",
          label: "Empty intensifier",
          severity: "weak",
          why: `"${intensifier}" adds emphasis but no information. Removing it almost always makes the sentence stronger.`,
          suggestion: "Delete it.",
          excerpt: excerptFor(sentence, intensifier),
          segment_index: segmentIndex,
        });
      }
    }

    // ---- CV-specific segment rules
    // These encode a house style for CVs, so they are not applied to letters.
    if (kind === "cv") {
      const isSummary = segmentIndex === summaryIndex;

      if (DASH_RE.test(segment)) {
        findings.push({
          rule_id: "em_dash",
          label: "Em dash",
          severity: "strong",
          why: "No em dashes in a CV. They read as drafted rather than written, and a full stop or a comma always works.",
          suggestion: "Replace with a full stop, a comma, or parentheses for scope.",
          excerpt: segment,
          segment_index: segmentIndex,
        });
      }

      if (isSummary) {
        const lowerSegment = segment.toLowerCase();
        const abstract = ABSTRACT_NOUNS.find(
          (w) => phraseRegex(w).test(lowerSegment) && !inDomainException(lowerSegment, w)
        );
        if (abstract) {
          findings.push({
            rule_id: "abstract_noun",
            label: "Abstract noun in the profile",
            severity: "strong",
            why: `"${abstract}" is true of anyone. A summary built from words like this survives having the name swapped for someone else's.`,
            suggestion: "Replace with what this person actually does, and for whom.",
            excerpt: segment,
            segment_index: segmentIndex,
          });
        }

        const warmUp = WARM_UP_OPENERS.find((w) => phraseRegex(w).test(segment.toLowerCase()));
        if (warmUp) {
          findings.push({
            rule_id: "warm_up_opener",
            label: "Warm-up opener",
            severity: "strong",
            why: "The first line is spent clearing its throat. Start with what the person does.",
            suggestion: `Delete "${warmUp}" and start at the next real word.`,
            excerpt: segment,
            segment_index: segmentIndex,
          });
        }
      } else {
        // Bullet shape.
        const firstWord = words(segment)[0] ?? "";
        if (NON_VERB_OPENERS.has(firstWord) || firstWord.endsWith("ing")) {
          findings.push({
            rule_id: "not_verb_first",
            label: "Bullet doesn't start with a verb",
            severity: "weak",
            why: `Starts with "${firstWord}". A recruiter scanning first words needs a past-tense verb there.`,
            suggestion: "Rewrite so the first word is what you did: Led, Ran, Built, Cut, Grew.",
            excerpt: segment,
            segment_index: segmentIndex,
          });
        }

        const pronoun = segment.match(BULLET_PRONOUNS);
        if (pronoun) {
          findings.push({
            rule_id: "pronoun_in_bullet",
            label: "Pronoun in a bullet",
            severity: "weak",
            why: "CV bullets drop the pronoun. The reader already knows whose CV this is.",
            suggestion: `Cut "${pronoun[0]}".`,
            excerpt: segment,
            segment_index: segmentIndex,
          });
        }

        const join = TWO_IDEA_JOINS.find((j) => segment.toLowerCase().includes(j));
        if (join) {
          findings.push({
            rule_id: "two_ideas",
            label: "Two ideas in one bullet",
            severity: "weak",
            why: `Joined by "${join.trim()}". Two ideas means two bullets, or one of them gets cut.`,
            suggestion: "Split it, or drop the weaker half.",
            excerpt: segment,
            segment_index: segmentIndex,
          });
        }

        if (segment.length > MAX_BULLET_CHARS) {
          findings.push({
            rule_id: "bullet_too_long",
            label: "Bullet runs past two lines",
            severity: "weak",
            why: `${segment.length} characters — around three rendered lines. Skimmability is the governing constraint.`,
            suggestion: "Cut to the outcome and the scope.",
            excerpt: segment,
            segment_index: segmentIndex,
          });
        }
      }
    }
  });

  // ---- document-level rules
  const metrics = computeMetrics(fullText);
  const segmentLengths = cleaned.map((s) => words(s).length);

  // Spread has to be measured relative to average length: two words of variation
  // is uniform for 14-word bullets and varied for 6-word ones. This is the
  // coefficient of variation — stdev as a fraction of the mean.
  const meanLength =
    segmentLengths.reduce((a, b) => a + b, 0) / Math.max(1, segmentLengths.length);
  const spread =
    segmentLengths.length < 2
      ? 0
      : Math.sqrt(
          segmentLengths.reduce((acc, n) => acc + (n - meanLength) ** 2, 0) /
            segmentLengths.length
        );
  const relativeSpread = meanLength === 0 ? 0 : spread / meanLength;

  if (kind === "cv" && cleaned.length >= 4 && relativeSpread < 0.1) {
    findings.push({
      rule_id: "uniform_length",
      label: "Every bullet the same length",
      severity: "weak",
      why: "Human CVs are lumpy — some bullets are short, some run long. Near-identical lengths are a sign of generated text.",
      suggestion: "Cut the weakest bullets down; let the important ones breathe.",
      excerpt: `${cleaned.length} bullets, all within ${Math.round(relativeSpread * 100)}% of the average length`,
      segment_index: -1,
    });
  }

  // Evidence is judged across the whole CV, never bullet by bullet. Plenty of
  // real responsibility bullets carry no figure, and flagging each one buries the
  // panel in noise. A CV where *most* entries name nothing checkable is the
  // actual problem worth reporting.
  if (kind === "cv" && cleaned.length >= 4) {
    const withoutEvidence = cleaned.filter(
      (s) => !NUMBER_IN_TEXT.test(s) && !/\s[A-Z][a-zA-Z]{2,}/.test(s)
    );
    const share = withoutEvidence.length / cleaned.length;
    if (share >= 0.6) {
      findings.push({
        rule_id: "evidence_thin",
        label: "Little checkable evidence",
        severity: "weak",
        why: `${withoutEvidence.length} of ${cleaned.length} entries name no figure, system or place — nothing an interviewer can pick up and ask about.`,
        suggestion: "Add numbers, tool names or markets to the entries that carry the most weight.",
        excerpt: withoutEvidence[0],
        segment_index: -1,
      });
    }
  }

  const openers = cleaned
    .map((s) => words(s)[0])
    .filter((w): w is string => Boolean(w));
  const openerCounts = new Map<string, number>();
  for (const opener of openers) openerCounts.set(opener, (openerCounts.get(opener) ?? 0) + 1);
  for (const [opener, count] of openerCounts) {
    if (count >= 3) {
      findings.push({
        rule_id: "repeated_opener",
        label: "Repeated opening word",
        severity: "weak",
        why: `${count} entries start with "${opener}". Repetition at the start of a line is very visible when scanning.`,
        suggestion: "Vary the verb, or restructure the weaker entries.",
        excerpt: `"${opener}" opens ${count} entries`,
        segment_index: -1,
      });
    }
  }

  if (metrics.sentence_count >= 3 && metrics.dash_per_sentence > 0.6) {
    findings.push({
      rule_id: "dash_habit",
      label: "Heavy dash use",
      severity: "weak",
      why: "Frequent em dashes are one of the most commented-on signals of AI-written text — roughly one per sentence here.",
      suggestion: "Keep one for genuine emphasis; make the rest full stops or commas.",
      excerpt: `${metrics.dash_per_sentence} dashes per sentence`,
      segment_index: -1,
    });
  }

  if (metrics.word_count >= 60 && metrics.adverb_ly_per_100 > 3.5) {
    findings.push({
      rule_id: "adverb_heavy",
      label: "Adverb padding",
      severity: "weak",
      why: "Words ending in -ly (successfully, effectively, seamlessly) usually pad a claim rather than support it.",
      suggestion: "Cut them, or replace with the outcome they're standing in for.",
      excerpt: `${metrics.adverb_ly_per_100} -ly adverbs per 100 words`,
      segment_index: -1,
    });
  }

  // ---- score
  const strong = findings.filter((f) => f.severity === "strong").length;
  const weak = findings.length - strong;
  const score = Math.max(0, Math.min(100, 100 - (strong * 9 + weak * 4)));

  return {
    findings,
    score,
    band: score >= 85 ? "reads human" : score >= 70 ? "a few tells" : "reads machine-written",
    strong_count: strong,
    weak_count: weak,
    metrics,
  };
}

/** Convenience: the segments of a CV variant, in the order they appear. */
export function cvSegments(input: {
  profile_summary: string;
  experience: { bullets: string[] }[];
}): string[] {
  return [input.profile_summary, ...input.experience.flatMap((e) => e.bullets)];
}
