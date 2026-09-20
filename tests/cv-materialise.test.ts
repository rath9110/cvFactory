import { test } from "node:test";
import assert from "node:assert/strict";
import { materialiseVariant } from "../lib/cv-generator.ts";
import { sourceBullets } from "../lib/profile-context.ts";
import type { CVSelection, MasterProfile } from "../lib/profile-types.ts";

const PROFILE = {
  name: "Test Person",
  headline: "Delivery lead",
  profile_summary: "Summary.",
  contact: {},
  experience_blocks: [
    {
      id: "block-a",
      company: "ACME",
      role: "Lead",
      period: "2020-2024",
      context: "Context",
      responsibilities: ["Ran the weekly planning forum", "Owned the vendor relationship"],
      outcomes: ["Cut reporting turnaround from 5 days to 4 hours", "Grew the marketable base 40%"],
      tools_methods: ["SQL"],
      transferable_themes: ["delivery"],
    },
    {
      id: "block-b",
      company: "Other",
      role: "Analyst",
      period: "2018-2020",
      context: "Context",
      responsibilities: ["Built the reporting layer"],
      outcomes: ["Shipped in 11 weeks"],
      tools_methods: [],
      transferable_themes: [],
    },
  ],
  proof_library: [],
  tone_rules: [],
  positioning_tensions: [],
  education: [],
  certifications: [],
  skills_taxonomy: [{ category: "Data", items: ["SQL", "dbt"] }],
  languages: [],
  learned_preferences: [],
} satisfies MasterProfile;

// Index order is outcomes first, then responsibilities.
const A = sourceBullets(PROFILE.experience_blocks[0]);

function selection(over: Partial<CVSelection> = {}): CVSelection {
  return {
    profile_summary: "Reframed summary.",
    experience_order: ["block-a", "block-b"],
    experience: [
      { block_id: "block-a", bullets: [0, 2], rewrites: {} },
      { block_id: "block-b", bullets: [0], rewrites: {} },
    ],
    skills: [{ category: "Data", items: ["SQL"] }],
    emphasis_notes: "Led with delivery.",
    ...over,
  };
}

test("bullet text comes from the profile, in the selected order", () => {
  const variant = materialiseVariant(selection(), PROFILE);
  assert.deepEqual(variant.experience[0].bullets, [A[0], A[2]]);
  assert.equal(A[0], "Cut reporting turnaround from 5 days to 4 hours", "outcomes index first");
  assert.equal(A[2], "Ran the weekly planning forum", "responsibilities follow");
});

test("selection can drop bullets and reorder them", () => {
  const variant = materialiseVariant(
    selection({
      experience: [
        { block_id: "block-a", bullets: [3, 1], rewrites: {} },
        { block_id: "block-b", bullets: [0], rewrites: {} },
      ],
    }),
    PROFILE
  );
  assert.deepEqual(variant.experience[0].bullets, [A[3], A[1]]);
});

test("a bullet that does not exist in the profile cannot be expressed", () => {
  // The whole point of the format: there is no field where invented text fits.
  assert.throws(
    () =>
      materialiseVariant(
        selection({
          experience: [{ block_id: "block-a", bullets: [99], rewrites: {} }],
        }),
        PROFILE
      ),
    /selected bullet 99 .* has 4 bullets/
  );
});

test("an unknown block id is rejected, in the order list and in the entries", () => {
  assert.throws(
    () => materialiseVariant(selection({ experience_order: ["nope"] }), PROFILE),
    /unknown experience block id: nope/
  );
  assert.throws(
    () =>
      materialiseVariant(
        selection({ experience: [{ block_id: "nope", bullets: [0], rewrites: {} }] }),
        PROFILE
      ),
    /unknown experience block id: nope/
  );
});

test("a rewrite that keeps the facts is accepted", () => {
  const variant = materialiseVariant(
    selection({
      experience: [
        {
          block_id: "block-a",
          bullets: [0],
          rewrites: { "0": "Cut reporting turnaround from 5 days to 4 hours for the team" },
        },
      ],
    }),
    PROFILE
  );
  assert.match(variant.experience[0].bullets[0], /for the team$/);
});

test("a rewrite that invents content is rejected", () => {
  assert.throws(
    () =>
      materialiseVariant(
        selection({
          experience: [
            {
              block_id: "block-a",
              bullets: [0],
              rewrites: { "0": "Led a team of 30 engineers across four continents" },
            },
          ],
        }),
        PROFILE
      ),
    /drifted from its source/
  );
});

test("a rewrite cannot smuggle in another bullet's content", () => {
  // Rewrites are checked against their own source bullet, not the whole block,
  // so pointing bullet 0 at bullet 1's text is caught.
  assert.throws(
    () =>
      materialiseVariant(
        selection({
          experience: [
            { block_id: "block-a", bullets: [0], rewrites: { "0": A[1] } },
          ],
        }),
        PROFILE
      ),
    /drifted from its source/
  );
});

test("an empty or whitespace rewrite falls back to the original bullet", () => {
  const variant = materialiseVariant(
    selection({
      experience: [{ block_id: "block-a", bullets: [0], rewrites: { "0": "   " } }],
    }),
    PROFILE
  );
  assert.equal(variant.experience[0].bullets[0], A[0]);
});

test("a rewrite keyed to an unselected bullet is simply ignored", () => {
  const variant = materialiseVariant(
    selection({
      experience: [{ block_id: "block-a", bullets: [0], rewrites: { "3": "anything at all" } }],
    }),
    PROFILE
  );
  assert.deepEqual(variant.experience[0].bullets, [A[0]]);
});

test("invented skills are filtered out and emptied groups dropped", () => {
  const variant = materialiseVariant(
    selection({ skills: [{ category: "Data", items: ["SQL", "Kubernetes"] }] }),
    PROFILE
  );
  assert.deepEqual(variant.skills, [{ category: "Data", items: ["SQL"] }]);

  const none = materialiseVariant(
    selection({ skills: [{ category: "Data", items: ["Kubernetes"] }] }),
    PROFILE
  );
  assert.deepEqual(none.skills, []);
});

test("the materialised variant is the shape the rest of the app already stores", () => {
  const variant = materialiseVariant(selection(), PROFILE);
  assert.equal(typeof variant.profile_summary, "string");
  assert.ok(Array.isArray(variant.experience_order));
  for (const block of variant.experience) {
    assert.ok(block.bullets.every((b) => typeof b === "string" && b.length > 0));
  }
});

// ------------------------------------------------- never invent a number

test("a rewrite cannot introduce a figure the source bullet does not have", () => {
  assert.throws(
    () =>
      materialiseVariant(
        selection({
          experience: [
            {
              block_id: "block-a",
              bullets: [0],
              // Source says 5 days to 4 hours; this rounds it into something new.
              rewrites: { "0": "Cut reporting turnaround from 5 days to 2 hours" },
            },
          ],
        }),
        PROFILE
      ),
    /introduces the figure "2"/
  );
});

test("a rewrite may keep or drop the source figures", () => {
  const kept = materialiseVariant(
    selection({
      experience: [
        {
          block_id: "block-a",
          bullets: [0],
          rewrites: { "0": "Cut reporting turnaround from 5 days to 4 hours for the team" },
        },
      ],
    }),
    PROFILE
  );
  assert.match(kept.experience[0].bullets[0], /5 days to 4 hours/);
});

test("the profile summary cannot carry an untraceable figure", () => {
  assert.throws(
    () => materialiseVariant(selection({ profile_summary: "Lead with 12 years of delivery." }), PROFILE),
    /appears nowhere in the master profile/
  );
  // 40 appears in the profile's own outcomes, so it traces.
  const ok = materialiseVariant(
    selection({ profile_summary: "Grew the marketable base 40% across the portfolio." }),
    PROFILE
  );
  assert.match(ok.profile_summary, /40%/);
});
