import type { MasterProfile } from "./profile-types";

/**
 * The master profile as one block of prompt text, shared byte-for-byte by every
 * call that needs it.
 *
 * Two things depend on it being identical across calls:
 *
 * 1. Prompt caching is a prefix match. The analyzer, both generators and the CV
 *    critique all send this block first, so after the first call in a flow the
 *    rest read it from cache at a fraction of the input price. One stray space
 *    and every later call pays full price again — which is why this function is
 *    the only place the profile is serialised for a prompt.
 * 2. Every prompt judges "is this claim in the profile?" against the same text.
 *
 * Two deliberate choices about content:
 *   - `contact` is stripped. No prompt has ever referenced it, and there is no
 *     reason to send a phone number and home address to an API.
 *   - The JSON is compact. Indentation is about 17% of the profile's tokens and
 *     carries no information a model needs.
 */
/**
 * The canonical bullet list for one experience block: outcomes first (they are
 * the stronger material), then responsibilities.
 *
 * Position in this array IS the bullet index the CV generator selects by, so
 * this function is the single definition of that numbering. The prompt, the
 * validator and the materialiser all call it — if they ever disagreed, the
 * generator would silently select the wrong bullets.
 */
export function sourceBullets(block: {
  outcomes: string[];
  responsibilities: string[];
}): string[] {
  return [...block.outcomes, ...block.responsibilities];
}

export function profileContext(profile: MasterProfile): string {
  // Built key-by-key rather than spread-and-delete so the serialised order is
  // fixed by this function, not by however the object was constructed upstream.
  const forPrompt = {
    name: profile.name,
    headline: profile.headline,
    profile_summary: profile.profile_summary,
    // Blocks are flattened to one `bullets` array so an index is unambiguous.
    // No prompt has ever referenced the outcomes/responsibilities split, and
    // collapsing it here removes any chance of the model counting positions
    // across two arrays and picking the wrong bullet.
    experience_blocks: profile.experience_blocks.map((block) => ({
      id: block.id,
      company: block.company,
      role: block.role,
      period: block.period,
      context: block.context,
      bullets: sourceBullets(block),
      tools_methods: block.tools_methods,
      transferable_themes: block.transferable_themes,
    })),
    proof_library: profile.proof_library,
    tone_rules: profile.tone_rules,
    positioning_tensions: profile.positioning_tensions,
    education: profile.education,
    certifications: profile.certifications,
    skills_taxonomy: profile.skills_taxonomy,
    languages: profile.languages,
    learned_preferences: profile.learned_preferences,
  };

  return `# Candidate master profile — the source of truth. Never state anything about the candidate that is not present here.
\`\`\`json
${JSON.stringify(forPrompt)}
\`\`\``;
}
