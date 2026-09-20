import { test } from "node:test";
import assert from "node:assert/strict";
import {
  averageMetrics,
  biggestDrifts,
  compareMetrics,
  computeMetrics,
  lexicalSignature,
  paragraphs,
  sentences,
  words,
} from "../lib/voice-metrics.ts";

// A deliberately plain, concrete style: short sentences, contractions, numbers.
const DIRECT = `I led the consent rollout across 60 markets. It wasn't glamorous work.
We shipped in 11 weeks. The legal review took 3 of those.`;

// The register the generator tends to produce: long, hedged, abstract, inflated.
const INFLATED = `I am truly passionate about the opportunity to leverage my extensive
and highly transferable experience in order to drive exceptional outcomes that are
consistently delivered across a genuinely dynamic environment, and I believe that my
proven track record is somewhat uniquely suited to this incredibly exciting role.`;

test("splitting: line breaks end a sentence so CV bullets count individually", () => {
  const bullets = "Led consent rollout across 60+ markets\nOwned vendor evaluation\nBuilt the reporting layer";
  assert.equal(sentences(bullets).length, 3);
  // Bullet glyphs and leading dashes are stripped, not counted as words.
  assert.deepEqual(words("• Led  rollout"), ["led", "rollout"]);
});

test("splitting: hard-wrapped prose is rejoined, not counted as several sentences", () => {
  const wrapped =
    "I led the consent rollout across sixty markets in Europe and Asia,\n" +
    "working with legal and commercial teams throughout the programme.";
  assert.equal(sentences(wrapped).length, 1, "a comma-ended wrap continues the sentence");

  const lowercaseContinuation = "The rollout covered sixty markets\nand took eleven weeks.";
  assert.equal(sentences(lowercaseContinuation).length, 1);

  // But a genuine list stays a list, whether or not it is glyph-marked.
  assert.equal(
    sentences("Led consent rollout across 60 markets\nOwned vendor evaluation").length,
    2
  );
  assert.equal(
    sentences("- Led consent rollout\n- Owned vendor evaluation\n- Built reporting").length,
    3
  );
  assert.equal(sentences("1. First item\n2. Second item").length, 2);
});

test("splitting: paragraphs need a blank line, sentences do not", () => {
  const text = "One. Two.\nStill first block.\n\nSecond block.";
  assert.equal(paragraphs(text).length, 2);
  assert.equal(sentences(text).length, 4);
});

test("empty and whitespace input produce zeros, never NaN", () => {
  for (const input of ["", "   ", "\n\n", "!!!"]) {
    const m = computeMetrics(input);
    for (const [key, value] of Object.entries(m)) {
      assert.ok(Number.isFinite(value), `${key} was ${value} for input ${JSON.stringify(input)}`);
      assert.equal(value, 0, `${key} should be 0 for empty input`);
    }
  }
});

test("metrics are deterministic — same text, same numbers", () => {
  assert.deepEqual(computeMetrics(DIRECT), computeMetrics(DIRECT));
});

test("metrics are length-independent: repeating a text barely moves the rates", () => {
  const once = computeMetrics(DIRECT);
  const thrice = computeMetrics([DIRECT, DIRECT, DIRECT].join("\n"));
  assert.ok(Math.abs(once.avg_sentence_length - thrice.avg_sentence_length) < 0.5);
  assert.ok(Math.abs(once.first_person_per_100 - thrice.first_person_per_100) < 0.5);
  // ...while the raw counts do scale.
  assert.ok(thrice.word_count > once.word_count * 2.5);
});

test("the two registers separate on the metrics that matter", () => {
  const direct = computeMetrics(DIRECT);
  const inflated = computeMetrics(INFLATED);

  assert.ok(
    inflated.avg_sentence_length > direct.avg_sentence_length * 2,
    `expected much longer sentences: ${inflated.avg_sentence_length} vs ${direct.avg_sentence_length}`
  );
  assert.ok(inflated.booster_per_100 > direct.booster_per_100);
  assert.ok(inflated.platitude_per_100 > direct.platitude_per_100);
  assert.ok(inflated.hedge_per_100 > direct.hedge_per_100);
  assert.ok(
    direct.number_per_100 > inflated.number_per_100,
    "the concrete text should carry more figures"
  );
  assert.ok(direct.contraction_per_sentence > 0, "wasn't → one contraction");
  assert.equal(inflated.contraction_per_sentence, 0);
});

test("possessive 's is not counted as a contraction", () => {
  const possessive = computeMetrics("The company's policy applies. The team's remit is broad.");
  assert.equal(possessive.contraction_per_sentence, 0);
  const real = computeMetrics("It's fine. That's the policy.");
  assert.equal(real.contraction_per_sentence, 1);
});

test("passive markers are detected, active voice is not flagged", () => {
  assert.ok(computeMetrics("The rollout was delivered by the team.").passive_marker_per_sentence > 0);
  assert.equal(computeMetrics("The team delivered the rollout.").passive_marker_per_sentence, 0);
});

test("numbers count figures, percentages and abbreviated magnitudes", () => {
  const m = computeMetrics("Grew it 40% to 1.2m across 60 markets in 11 weeks.");
  assert.ok(m.number_per_100 > 0);
  assert.equal(computeMetrics("Grew it substantially across many markets.").number_per_100, 0);
});

test("sentence_length_spread separates flat rhythm from varied rhythm", () => {
  const flat = computeMetrics("One two three four.\nOne two three four.\nOne two three four.");
  const varied = computeMetrics("Yes.\nThis sentence is considerably longer than the one before it.\nShort again.");
  assert.equal(flat.sentence_length_spread, 0);
  assert.ok(varied.sentence_length_spread > 2);
});

test("compareMetrics reports direction and drops raw counts", () => {
  const deltas = compareMetrics(computeMetrics(DIRECT), computeMetrics(INFLATED));
  assert.ok(!deltas.some((d) => d.key === "word_count"), "raw counts are not voice signals");

  const sentenceLength = deltas.find((d) => d.key === "avg_sentence_length")!;
  assert.equal(sentenceLength.direction, "higher");
  assert.ok(sentenceLength.relative !== null && sentenceLength.relative > 1);

  const contractions = deltas.find((d) => d.key === "contraction_per_sentence")!;
  assert.equal(contractions.direction, "lower");
});

test("compareMetrics survives a zero reference without dividing by zero", () => {
  const deltas = compareMetrics(computeMetrics(""), computeMetrics(DIRECT));
  for (const d of deltas) {
    assert.ok(Number.isFinite(d.difference));
    assert.equal(d.relative, null, `${d.key} should report null, not Infinity`);
  }
  assert.deepEqual(biggestDrifts(deltas), [], "nulls cannot be ranked as drift");
});

test("biggestDrifts ignores small differences and ranks the rest", () => {
  const deltas = compareMetrics(computeMetrics(DIRECT), computeMetrics(INFLATED));
  const top = biggestDrifts(deltas, 3);
  assert.ok(top.length > 0 && top.length <= 3);
  for (const d of top) assert.ok(Math.abs(d.relative!) >= 0.25);
  for (let i = 1; i < top.length; i++) {
    assert.ok(Math.abs(top[i - 1].relative!) >= Math.abs(top[i].relative!), "sorted by size");
  }
});

test("averageMetrics averages a corpus", () => {
  const avg = averageMetrics([computeMetrics(DIRECT), computeMetrics(INFLATED)]);
  const a = computeMetrics(DIRECT).avg_sentence_length;
  const b = computeMetrics(INFLATED).avg_sentence_length;
  assert.ok(Math.abs(avg.avg_sentence_length - (a + b) / 2) < 0.02);
  assert.deepEqual(averageMetrics([]).word_count, 0);
});

test("lexicalSignature surfaces words one text leans on and the other does not", () => {
  const sig = lexicalSignature(INFLATED, DIRECT, { minOccurrences: 1, limit: 20 });
  const found = sig.map((e) => e.word);
  assert.ok(found.includes("passionate") || found.includes("leverage"));
  // A word both texts use should not rank at the top.
  const top3 = sig.slice(0, 3).map((e) => e.word);
  assert.ok(!top3.includes("the"), "stop words are excluded entirely");
});

test("lexicalSignature handles an empty baseline and empty subject", () => {
  assert.deepEqual(lexicalSignature("", DIRECT), []);
  const sig = lexicalSignature(DIRECT, "", { minOccurrences: 1 });
  for (const e of sig) assert.ok(Number.isFinite(e.ratio), `${e.word} ratio was ${e.ratio}`);
});
