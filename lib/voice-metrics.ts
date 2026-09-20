/**
 * Deterministic writing-style measurements.
 *
 * "Deterministic" here means: no model calls, no network, no randomness. The same
 * text always produces exactly the same numbers, and running this costs nothing.
 * Everything in this file is a pure function over a string.
 *
 * The point is to describe *how* a piece of text is written — sentence rhythm,
 * punctuation habits, how often it reaches for an intensifier — so that a draft
 * written by the model can be compared against writing the user actually produced.
 *
 * Every measurement below is a heuristic. They are consistent (the same text always
 * scores the same) and useful for comparison, but none of them is linguistics.
 */

export type VoiceMetrics = {
  word_count: number;
  sentence_count: number;
  paragraph_count: number;

  /** Rhythm. Spread is the standard deviation — how much sentence length varies. */
  avg_sentence_length: number;
  sentence_length_spread: number;
  avg_word_length: number;
  avg_paragraph_words: number;

  /** Vocabulary habits, normalised per 100 words so texts of any length compare. */
  first_person_per_100: number;
  adverb_ly_per_100: number;
  hedge_per_100: number;
  booster_per_100: number;
  platitude_per_100: number;
  number_per_100: number;

  /** Punctuation and construction habits, normalised per sentence. */
  comma_per_sentence: number;
  dash_per_sentence: number;
  semicolon_colon_per_sentence: number;
  contraction_per_sentence: number;
  passive_marker_per_sentence: number;
};

export type VoiceMetricKey = keyof VoiceMetrics;

/** UI copy for each metric, so every surface explains itself the same way. */
export const VOICE_METRIC_META: Record<
  VoiceMetricKey,
  { label: string; unit: string; plain: string }
> = {
  word_count: { label: "Words", unit: "", plain: "Total length." },
  sentence_count: { label: "Sentences", unit: "", plain: "Sentence count." },
  paragraph_count: { label: "Paragraphs", unit: "", plain: "Blocks separated by a blank line." },
  avg_sentence_length: {
    label: "Sentence length",
    unit: "words",
    plain: "Average words per sentence. Long sentences read as formal or academic.",
  },
  sentence_length_spread: {
    label: "Length variation",
    unit: "words",
    plain:
      "How much sentence length varies. A low number means every sentence is the same size, which reads as flat.",
  },
  avg_word_length: {
    label: "Word length",
    unit: "chars",
    plain: "Average characters per word. Longer words read as more formal.",
  },
  avg_paragraph_words: {
    label: "Paragraph size",
    unit: "words",
    plain: "Average words per paragraph.",
  },
  first_person_per_100: {
    label: "First person",
    unit: "per 100 words",
    plain: "How often the writing says I, me, my, we, our.",
  },
  adverb_ly_per_100: {
    label: "-ly adverbs",
    unit: "per 100 words",
    plain: "Words like 'successfully' or 'significantly'. High counts read as padded.",
  },
  hedge_per_100: {
    label: "Hedging",
    unit: "per 100 words",
    plain: "Softeners like 'fairly', 'somewhat', 'I think'.",
  },
  booster_per_100: {
    label: "Intensifiers",
    unit: "per 100 words",
    plain: "Words like 'very', 'hugely', 'world-class'. This is what overselling looks like numerically.",
  },
  platitude_per_100: {
    label: "Corporate filler",
    unit: "per 100 words",
    plain: "Phrases like 'leverage', 'synergy', 'passionate about'.",
  },
  number_per_100: {
    label: "Concrete numbers",
    unit: "per 100 words",
    plain: "Figures, percentages, dates. The opposite of vague claims.",
  },
  comma_per_sentence: {
    label: "Commas",
    unit: "per sentence",
    plain: "Comma habit — a rough proxy for clause-heavy sentences.",
  },
  dash_per_sentence: {
    label: "Dashes",
    unit: "per sentence",
    plain: "Em dashes and hyphenated asides — like this one.",
  },
  semicolon_colon_per_sentence: {
    label: "Semicolons / colons",
    unit: "per sentence",
    plain: "A distinctive habit: some people never use them.",
  },
  contraction_per_sentence: {
    label: "Contractions",
    unit: "per sentence",
    plain: "\"don't\", \"I'm\", \"it's\". Almost the single clearest formal/informal signal.",
  },
  passive_marker_per_sentence: {
    label: "Passive markers",
    unit: "per sentence",
    plain: "Constructions like 'was delivered' rather than 'delivered'.",
  },
};

// ---------------------------------------------------------------- word lists

const FIRST_PERSON = new Set(["i", "me", "my", "mine", "myself", "we", "us", "our", "ours"]);

const HEDGE_WORDS = new Set([
  "maybe", "perhaps", "possibly", "probably", "fairly", "somewhat", "arguably",
  "seemingly", "apparently", "relatively", "rather", "slightly", "generally",
  "typically", "essentially", "basically", "roughly", "approximately", "mostly",
]);

const HEDGE_PHRASES = [
  "i think", "i believe", "i feel", "sort of", "kind of", "a bit", "to some extent",
];

const BOOSTER_WORDS = new Set([
  "very", "extremely", "incredibly", "hugely", "massively", "enormously", "truly",
  "highly", "deeply", "absolutely", "utterly", "immensely", "tremendously",
  "amazing", "exceptional", "outstanding", "phenomenal", "unparalleled",
]);

const BOOSTER_PHRASES = [
  "world-class", "world class", "best-in-class", "best in class",
  "cutting-edge", "cutting edge", "state-of-the-art", "state of the art",
];

const PLATITUDE_PHRASES = [
  "leverage", "synergy", "synergies", "passionate about", "thrilled to",
  "excited to", "delighted to", "value add", "value-add", "game changer",
  "game-changer", "think outside the box", "hit the ground running",
  "team player", "dynamic environment", "fast-paced environment", "go-getter",
  "results-driven", "detail-oriented", "proven track record",
];

/** Contractions, minus the bare possessive 's which would inflate formal text. */
const CONTRACTION_RE =
  /\b\w+['’](?:t|re|ve|ll|d|m)\b|\b(?:it|that|there|here|he|she|what|who|let|who|where|how)['’]s\b/gi;

const PASSIVE_RE =
  /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/gi;

const NUMBER_RE = /\b\d[\d.,]*%?\b|\b\d+[kmb]\b/gi;

// ---------------------------------------------------------------- tokenising

/** Words, lowercased, punctuation stripped. Hyphenated words stay whole. */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/['’]/g, "'")
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^[-']+|[-']+$/g, ""))
    .filter(Boolean);
}

/** Words that signal a line continues rather than ends. */
const CONTINUATION_ENDINGS = new Set([
  "and", "or", "but", "with", "for", "to", "of", "in", "on", "at", "by", "from",
  "as", "that", "which", "while", "across", "into", "than", "the", "a", "an",
]);

const BULLET_START_RE = /^\s*(?:[-*•·▪●]|\d+[.)])\s+/;

/**
 * Joins line breaks that are only soft wrapping, so a hard-wrapped paragraph is
 * measured as the long sentence it actually is.
 *
 * A break is kept when the previous line ends a sentence, or when the next line
 * looks like a new list item. It is treated as wrapping when the line clearly
 * runs on — ending in a comma or a joining word, or continuing with a lowercase
 * word.
 *
 * This matters because both shapes get uploaded: CV bullets (one idea per line,
 * often with no full stop) and letters hard-wrapped at 80 columns.
 */
function unwrapSoftBreaks(block: string): string {
  const lines = block.split(/\r?\n/);
  let out = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (out === "") {
      out = line;
      continue;
    }

    const endsSentence = /[.!?…]["')\]]?$/.test(out);
    const nextIsListItem = BULLET_START_RE.test(lines[i]);
    const lastWord = words(out).at(-1) ?? "";
    const runsOn = /[,;:—–-]$/.test(out) || CONTINUATION_ENDINGS.has(lastWord);
    const nextStartsLower = /^[a-zß-ÿ]/.test(line);

    const isWrap = !endsSentence && !nextIsListItem && (runsOn || nextStartsLower);
    out += isWrap ? " " + line : "\n" + line;
  }

  return out;
}

/**
 * Sentences. An intentional line break ends a sentence, so that CV bullets —
 * which often have no full stop — count as one sentence each instead of merging
 * into one enormous run-on. Soft wrapping is rejoined first.
 */
export function sentences(text: string): string[] {
  return unwrapSoftBreaks(text)
    .split(/\n/)
    // The list marker comes off first: the full stop in "1." is not a sentence end.
    .map((line) => line.replace(BULLET_START_RE, "").replace(/^[\s•]+/, ""))
    .flatMap((line) => line.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter((s) => words(s).length > 0);
}

export function paragraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => words(p).length > 0);
}

function countPhrases(haystack: string, phrases: string[]): number {
  let total = 0;
  for (const phrase of phrases) {
    // Word-boundary search so "leverage" does not match "leveraged".
    const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    total += (haystack.match(re) ?? []).length;
  }
  return total;
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) ?? []).length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - m) ** 2)));
}

/** Rounds to 2 decimals so stored metrics stay readable and stable. */
function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

// ---------------------------------------------------------------- the metrics

export function computeMetrics(text: string): VoiceMetrics {
  const allWords = words(text);
  const sents = sentences(text);
  const paras = paragraphs(text);
  const lower = text.toLowerCase().replace(/['’]/g, "'");

  const wordCount = allWords.length;
  const sentenceCount = sents.length;

  // Guard every rate: an empty text must produce zeros, never NaN or Infinity.
  const per100 = (n: number) => (wordCount === 0 ? 0 : (n / wordCount) * 100);
  const perSentence = (n: number) => (sentenceCount === 0 ? 0 : n / sentenceCount);

  const sentenceLengths = sents.map((s) => words(s).length);

  const firstPerson = allWords.filter((w) => FIRST_PERSON.has(w)).length;
  const lyAdverbs = allWords.filter((w) => w.endsWith("ly") && w.length > 4).length;
  const hedges =
    allWords.filter((w) => HEDGE_WORDS.has(w)).length + countPhrases(lower, HEDGE_PHRASES);
  const boosters =
    allWords.filter((w) => BOOSTER_WORDS.has(w)).length + countPhrases(lower, BOOSTER_PHRASES);
  const platitudes = countPhrases(lower, PLATITUDE_PHRASES);

  return {
    word_count: wordCount,
    sentence_count: sentenceCount,
    paragraph_count: paras.length,

    avg_sentence_length: round2(mean(sentenceLengths)),
    sentence_length_spread: round2(stdev(sentenceLengths)),
    avg_word_length: round2(mean(allWords.map((w) => w.length))),
    avg_paragraph_words: round2(mean(paras.map((p) => words(p).length))),

    first_person_per_100: round2(per100(firstPerson)),
    adverb_ly_per_100: round2(per100(lyAdverbs)),
    hedge_per_100: round2(per100(hedges)),
    booster_per_100: round2(per100(boosters)),
    platitude_per_100: round2(per100(platitudes)),
    number_per_100: round2(per100(countMatches(text, NUMBER_RE))),

    comma_per_sentence: round2(perSentence(countMatches(text, /,/g))),
    dash_per_sentence: round2(
      perSentence(countMatches(text, /—|–|\s-\s/g))
    ),
    semicolon_colon_per_sentence: round2(perSentence(countMatches(text, /[;:]/g))),
    contraction_per_sentence: round2(perSentence(countMatches(text, CONTRACTION_RE))),
    passive_marker_per_sentence: round2(perSentence(countMatches(text, PASSIVE_RE))),
  };
}

/** Average of several texts' metrics — the shape of a whole corpus. */
export function averageMetrics(list: VoiceMetrics[]): VoiceMetrics {
  const keys = Object.keys(VOICE_METRIC_META) as VoiceMetricKey[];
  const out = {} as VoiceMetrics;
  for (const key of keys) {
    out[key] = round2(mean(list.map((m) => m[key])));
  }
  return out;
}

// ---------------------------------------------------------------- comparison

export type MetricDelta = {
  key: VoiceMetricKey;
  reference: number;
  candidate: number;
  /** candidate − reference. */
  difference: number;
  /** How far apart, as a share of the reference. 1 = double. Null when reference is 0. */
  relative: number | null;
  direction: "higher" | "lower" | "same";
};

/**
 * Compares a draft (candidate) against the user's own writing (reference).
 * Counting metrics are excluded: a letter being shorter than a CV says nothing
 * about voice.
 */
const COUNTING_METRICS: VoiceMetricKey[] = [
  "word_count",
  "sentence_count",
  "paragraph_count",
];

export function compareMetrics(
  reference: VoiceMetrics,
  candidate: VoiceMetrics
): MetricDelta[] {
  const keys = (Object.keys(VOICE_METRIC_META) as VoiceMetricKey[]).filter(
    (k) => !COUNTING_METRICS.includes(k)
  );

  return keys.map((key) => {
    const ref = reference[key];
    const cand = candidate[key];
    const difference = round2(cand - ref);
    return {
      key,
      reference: ref,
      candidate: cand,
      difference,
      relative: ref === 0 ? null : round2((cand - ref) / ref),
      direction: difference > 0 ? "higher" : difference < 0 ? "lower" : "same",
    };
  });
}

/** The deltas that are furthest from the reference, largest gap first. */
export function biggestDrifts(deltas: MetricDelta[], limit = 5): MetricDelta[] {
  return [...deltas]
    .filter((d) => d.relative !== null && Math.abs(d.relative) >= 0.25)
    .sort((a, b) => Math.abs(b.relative!) - Math.abs(a.relative!))
    .slice(0, limit);
}

// ---------------------------------------------------------- lexical signature

export type LexicalEntry = {
  word: string;
  subject_per_1000: number;
  baseline_per_1000: number;
  /** How many times more often the subject uses it. */
  ratio: number;
};

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "of", "to", "in", "on", "for", "with",
  "at", "by", "from", "as", "is", "are", "was", "were", "be", "been", "being", "it",
  "its", "this", "that", "these", "those", "there", "their", "them", "they", "he",
  "she", "his", "her", "you", "your", "not", "no", "so", "than", "then", "up", "out",
  "about", "into", "over", "after", "before", "more", "most", "other", "such", "can",
  "will", "would", "should", "could", "has", "have", "had", "do", "does", "did",
  "which", "who", "whom", "what", "when", "where", "while", "also", "both", "each",
]);

/**
 * Words the subject text reaches for far more often than the baseline does.
 * Used two ways: the user's writing vs. the model's draft (what the model is
 * missing), and the other way round (what the model over-uses).
 */
export function lexicalSignature(
  subject: string,
  baseline: string,
  opts: { minOccurrences?: number; limit?: number } = {}
): LexicalEntry[] {
  const minOccurrences = opts.minOccurrences ?? 2;
  const limit = opts.limit ?? 15;

  const subjectWords = words(subject).filter((w) => !STOP_WORDS.has(w) && w.length > 2);
  const baselineWords = words(baseline).filter((w) => !STOP_WORDS.has(w) && w.length > 2);
  if (subjectWords.length === 0) return [];

  const count = (list: string[]) => {
    const m = new Map<string, number>();
    for (const w of list) m.set(w, (m.get(w) ?? 0) + 1);
    return m;
  };

  const subjectCounts = count(subjectWords);
  const baselineCounts = count(baselineWords);

  const entries: LexicalEntry[] = [];
  for (const [word, n] of subjectCounts) {
    if (n < minOccurrences) continue;
    const subjectRate = (n / subjectWords.length) * 1000;
    const baselineRate =
      baselineWords.length === 0
        ? 0
        : ((baselineCounts.get(word) ?? 0) / baselineWords.length) * 1000;
    // Smoothed so a word absent from the baseline gets a large but finite ratio
    // instead of dividing by zero.
    const ratio = subjectRate / (baselineRate + 0.5);
    entries.push({
      word,
      subject_per_1000: round2(subjectRate),
      baseline_per_1000: round2(baselineRate),
      ratio: round2(ratio),
    });
  }

  return entries.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}
