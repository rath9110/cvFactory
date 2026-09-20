import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeHumanity, cvSegments } from "../lib/ai-tells.ts";

const ids = (segments: string[], kind: "cv" | "letter" = "cv") =>
  analyzeHumanity({ segments, kind }).findings.map((f) => f.rule_id);

// A real bullet from the master profile: concrete, named, measured.
const GOOD_BULLETS = [
  "Led the consent and first-party data rollout across COS and ARKET in 60+ markets",
  "Ran vendor evaluation for the CDP, scoring four suppliers against 14 criteria",
  "Rebuilt the ARKET.com checkout flow with the Berlin engineering team",
  "Cut reporting turnaround from 5 days to 4 hours",
];

const AI_BULLETS = [
  "Spearheaded a comprehensive transformation that significantly improved outcomes",
  "Leveraged cutting-edge solutions to drive best-in-class results",
  "Played a key role in the implementation of various strategic initiatives",
  "Helped to deliver a wide range of highly impactful improvements",
];

test("concrete human bullets pass cleanly", () => {
  const report = analyzeHumanity({ segments: GOOD_BULLETS, kind: "cv" });
  assert.equal(report.strong_count, 0, `unexpected strong findings: ${JSON.stringify(report.findings, null, 2)}`);
  assert.ok(report.score >= 85, `score was ${report.score}`);
  assert.equal(report.band, "reads human");
});

test("generated-sounding bullets are caught, and named specifically", () => {
  const report = analyzeHumanity({ segments: AI_BULLETS, kind: "cv" });
  const found = new Set(report.findings.map((f) => f.rule_id));
  assert.ok(found.has("consultant_verb"), "spearheaded / leveraged");
  assert.ok(found.has("stock_phrase"), "cutting-edge / best-in-class");
  assert.ok(found.has("unquantified_scale"), "significantly, with no figure");
  assert.ok(found.has("weak_attribution"), "played a key role / helped to");
  assert.ok(found.has("nominalisation"), "the implementation of");
  assert.ok(report.score < 70, `score was ${report.score}`);
  assert.equal(report.band, "reads machine-written");
});

test("every finding carries its own text and a plain-language reason", () => {
  for (const f of analyzeHumanity({ segments: AI_BULLETS, kind: "cv" }).findings) {
    assert.ok(f.excerpt.length > 0, `${f.rule_id} had no excerpt`);
    assert.ok(f.why.length > 20, `${f.rule_id} had no usable explanation`);
    assert.ok(["strong", "weak"].includes(f.severity));
  }
});

test("scale words are only flagged when no figure backs them", () => {
  assert.ok(ids(["Significantly reduced processing time"]).includes("unquantified_scale"));
  assert.ok(
    !ids(["Significantly reduced processing time, from 5 days to 4 hours"]).includes(
      "unquantified_scale"
    ),
    "a figure in the same sentence answers the question"
  );
});

test("template letter openings are caught", () => {
  const found = ids(
    ["I am writing to express my interest in the Senior Manager position."],
    "letter"
  );
  assert.ok(found.includes("enthusiasm_opener"));
});

test("the not-just construction is caught in letter prose", () => {
  assert.ok(
    ids(["This is not just a delivery role, but a chance to shape the strategy."], "letter")
      .includes("not_just_construction")
  );
});

test("uniform bullet length is flagged, varied lengths are not", () => {
  // Measured relative to average length: real bullets here run 9–14 words and
  // must not be flagged, while these four all sit at 6–7.
  const uniform = [
    "Led the rollout of consent across markets",
    "Ran the evaluation of vendors across teams",
    "Built the reporting layer across regions",
    "Owned the migration of data across brands",
  ];
  assert.ok(ids(uniform).includes("uniform_length"));
  assert.ok(!ids(GOOD_BULLETS).includes("uniform_length"), "real bullets are lumpy");

  // Long bullets with the same proportional variation are equally uniform.
  const longUniform = uniform.map((b) => `${b} throughout the programme delivery cycle`);
  assert.ok(ids(longUniform).includes("uniform_length"), "the rule scales with length");
});

test("a repeated opening word is flagged only from three occurrences", () => {
  const twice = ["Led the rollout", "Led the migration", "Owned the reporting"];
  const thrice = ["Led the rollout", "Led the migration", "Led the reporting"];
  assert.ok(!ids(twice).includes("repeated_opener"));
  assert.ok(ids(thrice).includes("repeated_opener"));
});

test("dash habit needs a real habit, not a single dash", () => {
  const one = ["I led the rollout — it took eleven weeks.", "We shipped it.", "It worked."];
  const many = [
    "I led the rollout — it took eleven weeks.",
    "The team — all four of them — shipped it.",
    "It worked — mostly.",
  ];
  assert.ok(!ids(one, "letter").includes("dash_habit"));
  assert.ok(ids(many, "letter").includes("dash_habit"));
});

test("evidence is judged across the whole CV, not bullet by bullet", () => {
  // A single bullet without a figure is normal and must not be flagged.
  const mixed = [
    "Managed the process and improved how the team worked together",
    "Cut reporting turnaround from 5 days to 4 hours",
    "Rebuilt the checkout flow with the Berlin engineering team",
    "Ran vendor evaluation against 14 criteria",
  ];
  assert.ok(!ids(mixed).includes("evidence_thin"), "one vague bullet among four is fine");

  // A CV where nothing at all is checkable is one finding, not four.
  const vague = [
    "Managed the process and improved how the team worked together",
    "Owned the delivery of key initiatives for the business",
    "Drove alignment between teams and improved ways of working",
    "Supported the rollout and handled day-to-day coordination",
  ];
  const report = analyzeHumanity({ segments: vague, kind: "cv" });
  const thin = report.findings.filter((f) => f.rule_id === "evidence_thin");
  assert.equal(thin.length, 1, "reported once for the document");
  assert.ok(!ids(vague, "letter").includes("evidence_thin"), "letter prose is not a bullet list");
});

test("real hand-written bullets are not flagged as machine-written", () => {
  // These came from master_profile.json. The house-style rules may still have
  // opinions about them, but nothing here should read as generated: no stock
  // phrases, no inflated verbs, no template openings.
  const real = [
    "Translated customer journey and product requirements into clear, prioritised backlogs",
    "Partnered with UX, brand, and engineering to make trade-off decisions",
    "Led the consent rollout across COS and ARKET in 60+ markets",
  ];
  const report = analyzeHumanity({ segments: real, kind: "cv", summaryIndex: null });
  const machineRules = ["stock_phrase", "consultant_verb", "enthusiasm_opener", "not_just_construction"];
  const hits = report.findings.filter((f) => machineRules.includes(f.rule_id));
  assert.deepEqual(hits, [], JSON.stringify(hits, null, 2));
});

test("summary-only rules do not fire on bare bullets", () => {
  // "journey" is an abstract noun in a summary and a term of art in a bullet.
  const bullets = ["Translated customer journey requirements into backlogs"];
  const asBullets = analyzeHumanity({ segments: bullets, kind: "cv", summaryIndex: null });
  assert.ok(!asBullets.findings.some((f) => f.rule_id === "abstract_noun"));

  const asSummary = analyzeHumanity({
    segments: ["Operations lead focused on impact and growth mindset."],
    kind: "cv",
  });
  assert.ok(asSummary.findings.some((f) => f.rule_id === "abstract_noun"));
});

test("empty input is safe and scores as clean", () => {
  for (const segments of [[], [""], ["   ", ""]]) {
    const report = analyzeHumanity({ segments, kind: "cv" });
    assert.deepEqual(report.findings, []);
    assert.equal(report.score, 100);
    assert.ok(Number.isFinite(report.metrics.avg_sentence_length));
  }
});

test("the same text always produces the same report", () => {
  assert.deepEqual(
    analyzeHumanity({ segments: AI_BULLETS, kind: "cv" }),
    analyzeHumanity({ segments: AI_BULLETS, kind: "cv" })
  );
});

test("one sentence does not trip the same rule repeatedly", () => {
  // Three stock phrases in one sentence should report once for that rule.
  const report = analyzeHumanity({
    segments: ["A world-class, best-in-class, cutting-edge delivery approach"],
    kind: "cv",
  });
  assert.equal(report.findings.filter((f) => f.rule_id === "stock_phrase").length, 1);
});

test("cvSegments flattens a variant in document order", () => {
  const segments = cvSegments({
    profile_summary: "Summary text",
    experience: [{ bullets: ["a", "b"] }, { bullets: ["c"] }],
  });
  assert.deepEqual(segments, ["Summary text", "a", "b", "c"]);
});

test("findings point back at the segment they came from", () => {
  const report = analyzeHumanity({
    segments: ["Clean bullet with 40% growth at ARKET", "Spearheaded the synergy"],
    kind: "cv",
  });
  const tell = report.findings.find((f) => f.rule_id === "consultant_verb")!;
  assert.equal(tell.segment_index, 1);
});

// ---------------------------------------------------------- house-style rules

test("em dashes are banned outright in a CV, rationed in a letter", () => {
  const withDash = ["Led the rollout of Omni-id — ARKET's identity resolution work"];
  assert.ok(ids(withDash, "cv").includes("em_dash"));
  assert.ok(!ids(withDash, "letter").includes("em_dash"), "letters use the frequency rule");
});

test("hedges and filler around a verb are strong findings", () => {
  const report = analyzeHumanity({
    segments: [
      "Summary.",
      "Helped support the migration of the reporting layer",
      "Responsible for the coordination of vendor onboarding",
    ],
    kind: "cv",
  });
  const found = new Set(report.findings.map((f) => f.rule_id));
  assert.ok(found.has("weak_attribution"));
  assert.ok(found.has("filler_verb"));
  assert.ok(report.strong_count >= 2);
});

test("adjective strings are caught but lists of tools are not", () => {
  assert.ok(
    ids(["Strategic, analytical and collaborative operations lead."]).includes(
      "adjective_string"
    )
  );
  assert.ok(
    !ids(["Summary.", "Built pipelines in SQL, Python and dbt"]).includes("adjective_string"),
    "proper nouns are not adjectives"
  );
  assert.ok(
    !ids(["Summary.", "Partnered with legal, architecture and engineering"]).includes(
      "adjective_string"
    ),
    "a list of departments is not an adjective string"
  );
});

test("warm-up openers and abstract nouns are caught in the summary", () => {
  const found = ids(["Experienced professional with a strong background in data."]);
  assert.ok(found.includes("warm_up_opener"));
  assert.ok(ids(["Operations lead delivering excellence and impact."]).includes("abstract_noun"));
});

test("bullet shape: verb-first, no pronoun, one idea, two lines", () => {
  const report = analyzeHumanity({
    segments: [
      "Summary.",
      "Managing the consent rollout across markets",
      "Led my team through the replatform",
      "Cut turnaround from 5 days to 4 hours, and ran the vendor review",
      `Led a programme ${"that carried on at considerable length ".repeat(5)}`,
    ],
    kind: "cv",
  });
  const found = new Set(report.findings.map((f) => f.rule_id));
  assert.ok(found.has("not_verb_first"), "gerund opener");
  assert.ok(found.has("pronoun_in_bullet"));
  assert.ok(found.has("two_ideas"));
  assert.ok(found.has("bullet_too_long"));
});

test("a bullet obeying every rule is clean", () => {
  const report = analyzeHumanity({
    segments: ["Summary.", "Cut reporting turnaround from 5 days to 4 hours (4 brands, 60+ markets)"],
    kind: "cv",
  });
  assert.deepEqual(
    report.findings.filter((f) => f.segment_index === 1),
    []
  );
});
