import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateCvLength, lengthVerdict } from "../lib/cv-length.ts";
import type { CVVariant, ExperienceBlock } from "../lib/profile-types.ts";

function block(id: string, bulletCount: number): ExperienceBlock {
  return {
    id,
    company: "ACME",
    role: `Role ${id}`,
    period: "2020-2024",
    context: "A short line of context about the team.",
    responsibilities: Array.from({ length: bulletCount }, (_, i) => `Responsibility ${i} `.repeat(4)),
    outcomes: [],
    tools_methods: [],
    transferable_themes: [],
  };
}

function profileWith(blocks: ExperienceBlock[]) {
  return { experience_blocks: blocks, education: [], certifications: [], languages: [] };
}

function variant(blocks: ExperienceBlock[], bulletsPerBlock: number): CVVariant {
  return {
    profile_summary: "A four sentence summary. ".repeat(4),
    experience_order: blocks.map((b) => b.id),
    experience: blocks.map((b) => ({
      block_id: b.id,
      bullets: b.responsibilities.slice(0, bulletsPerBlock),
    })),
    skills: [{ category: "Data", items: ["SQL"] }],
    emphasis_notes: "Notes.",
  };
}

test("a short CV estimates around one page", () => {
  const blocks = [block("a", 3), block("b", 2)];
  const est = estimateCvLength(variant(blocks, 3), profileWith(blocks));
  assert.ok(est.pages > 0 && est.pages <= 1.2, `estimated ${est.pages} pages`);
  assert.equal(lengthVerdict(est.pages).tone, "good");
});

test("adding bullets always lengthens the estimate", () => {
  const blocks = [block("a", 8), block("b", 8)];
  const few = estimateCvLength(variant(blocks, 2), profileWith(blocks));
  const many = estimateCvLength(variant(blocks, 8), profileWith(blocks));
  assert.ok(many.lines > few.lines);
  assert.ok(many.pages > few.pages);
});

test("a sprawling CV is reported as over two pages", () => {
  // Real CV bullets run 100-150 characters and wrap to two lines, so six roles
  // keeping ten of them each is genuinely a three-page document.
  const long = Array.from({ length: 6 }, (_, i) => {
    const b = block(`b${i}`, 10);
    b.responsibilities = b.responsibilities.map(
      (r) => r + "with a clause that carries the bullet past a single rendered line"
    );
    return b;
  });
  const est = estimateCvLength(variant(long, 10), profileWith(long));
  assert.ok(est.pages > 2, `estimated ${est.pages} pages`);
  assert.equal(lengthVerdict(est.pages).tone, "bad");
});

test("the longest block is identified so there is somewhere to cut", () => {
  const blocks = [block("small", 1), block("huge", 12)];
  const v: CVVariant = {
    ...variant(blocks, 12),
    experience: [
      { block_id: "small", bullets: blocks[0].responsibilities.slice(0, 1) },
      { block_id: "huge", bullets: blocks[1].responsibilities },
    ],
  };
  const est = estimateCvLength(v, profileWith(blocks));
  assert.equal(est.longest?.block_id, "huge");
  assert.equal(est.longest?.bullet_count, 12);
});

test("blocks listed in experience_order but missing an entry are skipped", () => {
  const blocks = [block("a", 2)];
  const v: CVVariant = { ...variant(blocks, 2), experience_order: ["a", "ghost"] };
  const est = estimateCvLength(v, profileWith(blocks));
  assert.equal(est.blocks.length, 1);
  assert.ok(Number.isFinite(est.pages));
});

test("an empty variant is safe and near zero", () => {
  const est = estimateCvLength(
    {
      profile_summary: "",
      experience_order: [],
      experience: [],
      skills: [],
      emphasis_notes: "",
    },
    profileWith([])
  );
  assert.ok(Number.isFinite(est.pages));
  assert.equal(est.longest, null);
  assert.ok(est.pages < 0.5);
});

test("trailing sections rendered from the profile still count", () => {
  const blocks = [block("a", 2)];
  const bare = estimateCvLength(variant(blocks, 2), profileWith(blocks));
  const withExtras = estimateCvLength(variant(blocks, 2), {
    experience_blocks: blocks,
    education: [{}, {}],
    certifications: [{}],
    languages: ["Swedish"],
  });
  assert.ok(withExtras.lines > bare.lines);
});

test("the verdict bands read sensibly across the range", () => {
  assert.equal(lengthVerdict(0.9).tone, "good");
  assert.equal(lengthVerdict(1.2).tone, "warn");
  assert.equal(lengthVerdict(1.9).tone, "good");
  assert.equal(lengthVerdict(2.6).tone, "bad");
});
