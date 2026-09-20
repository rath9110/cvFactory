import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeHumanity } from "../lib/ai-tells.ts";
import { fixesFor } from "../lib/cv-fixes.ts";

/** The finding a rule produces for one bullet, as the UI would have it. */
function findingFor(ruleId: string, bullet: string) {
  const report = analyzeHumanity({ segments: [bullet], kind: "cv", summaryIndex: null });
  const finding = report.findings.find((f) => f.rule_id === ruleId);
  assert.ok(finding, `expected a ${ruleId} finding for: ${bullet}`);
  return finding;
}

function fixes(ruleId: string, bullet: string) {
  return fixesFor(findingFor(ruleId, bullet), bullet);
}

test("a single em dash offers a full stop and a comma", () => {
  const bullet = "Cut reporting turnaround to 4 hours — the team had asked for a week";
  const options = fixes("em_dash", bullet);
  const labels = options.map((f) => f.label);
  assert.deepEqual(labels, ["Full stop", "Comma"]);
  assert.equal(
    options[0].result,
    "Cut reporting turnaround to 4 hours. The team had asked for a week."
  );
  assert.equal(
    options[1].result,
    "Cut reporting turnaround to 4 hours, the team had asked for a week"
  );
});

test("a pair of em dashes offers parentheses first", () => {
  const bullet = "Led the rollout of Omni-id — ARKET's identity work — across 4 brands";
  const options = fixes("em_dash", bullet);
  assert.equal(options[0].label, "Parentheses");
  assert.equal(
    options[0].result,
    "Led the rollout of Omni-id (ARKET's identity work) across 4 brands"
  );
});

test("every em dash fix actually removes the dash", () => {
  for (const bullet of [
    "Owned delivery — end to end",
    "Ran the review — four suppliers — against 14 criteria",
  ]) {
    for (const fix of fixes("em_dash", bullet)) {
      assert.ok(!/[—–]/.test(fix.result), `${fix.label} left a dash: ${fix.result}`);
    }
  }
});

test("a two-idea bullet offers each half on its own", () => {
  const bullet = "Cut turnaround from 5 days to 4 hours, and ran the vendor review";
  const options = fixes("two_ideas", bullet);
  assert.deepEqual(options.map((f) => f.label), [
    "Keep the first half",
    "Keep the second half",
  ]);
  assert.equal(options[0].result, "Cut turnaround from 5 days to 4 hours");
  assert.equal(options[1].result, "Ran the vendor review");
});

test("an over-long bullet offers to keep its first sentence", () => {
  const bullet =
    "Led the consent rollout across 60 markets. It ran for eleven weeks with legal review taking three of them, the remaining work landed in the final fortnight, and the last market signed off a day before the deadline.";
  const options = fixes("bullet_too_long", bullet);
  assert.equal(options[0].label, "Keep the first sentence");
  assert.equal(options[0].result, "Led the consent rollout across 60 markets.");
});

test("a pronoun fix removes exactly the pronoun", () => {
  const options = fixes("pronoun_in_bullet", "Led my team through the ARKET replatform");
  assert.equal(options.length, 1);
  assert.equal(options[0].result, "Led team through the ARKET replatform");
});

test("no fix is offered where the repair needs judgement", () => {
  assert.deepEqual(
    fixesFor(
      findingFor("weak_attribution", "Helped support the migration of the reporting layer"),
      "Helped support the migration of the reporting layer"
    ),
    [],
    "cutting the hedge means rewriting the verb"
  );
  assert.deepEqual(
    fixesFor(
      findingFor("adjective_string", "Strategic, analytical and collaborative lead."),
      "Strategic, analytical and collaborative lead."
    ),
    []
  );
});

test("no fix ever introduces a word the bullet did not contain", () => {
  const bullets = [
    "Cut turnaround to 4 hours — the team had asked for a week",
    "Ran the review — four suppliers — against 14 criteria",
    "Cut turnaround from 5 days to 4 hours, and ran the vendor review",
    "Led my team through the replatform",
  ];
  for (const bullet of bullets) {
    const source = new Set(bullet.toLowerCase().match(/[a-z0-9']+/g) ?? []);
    const report = analyzeHumanity({ segments: [bullet], kind: "cv", summaryIndex: null });
    for (const finding of report.findings) {
      for (const fix of fixesFor(finding, bullet)) {
        for (const word of fix.result.toLowerCase().match(/[a-z0-9']+/g) ?? []) {
          assert.ok(source.has(word), `"${word}" was not in the source bullet`);
        }
      }
    }
  }
});

test("applying a fix clears the finding that produced it", () => {
  const bullet = "Led the rollout of Omni-id — ARKET's identity work — across 4 brands";
  for (const fix of fixes("em_dash", bullet)) {
    const after = analyzeHumanity({
      segments: [fix.result],
      kind: "cv",
      summaryIndex: null,
    });
    assert.ok(
      !after.findings.some((f) => f.rule_id === "em_dash"),
      `${fix.label} did not clear the finding`
    );
  }
});
