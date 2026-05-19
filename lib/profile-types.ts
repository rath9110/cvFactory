import { z } from "zod";

export const ExperienceBlockSchema = z.object({
  id: z.string(),
  company: z.string(),
  role: z.string(),
  period: z.string(),
  context: z.string().describe("What the company/team was, what the role existed to do"),
  responsibilities: z.array(z.string()),
  outcomes: z.array(z.string()).describe("Measurable or otherwise concrete results"),
  tools_methods: z.array(z.string()),
  transferable_themes: z.array(z.string()).describe(
    "Reusable framing labels — e.g., 'multi-stakeholder delivery', 'cross-market rollout'"
  ),
});

export const ProofPointSchema = z.object({
  id: z.string(),
  claim: z.string().describe("Short, concrete claim e.g., 'Led consent rollout across 60+ markets'"),
  category: z.enum([
    "scale",
    "delivery",
    "technical",
    "stakeholder",
    "strategy",
    "domain",
    "leadership",
  ]),
  source_experience_id: z.string().optional(),
  context: z.string().describe("One-line context the claim sits inside"),
  metric: z.string().optional().describe("Specific number/metric if applicable"),
});

export const ToneRuleSchema = z.object({
  id: z.string(),
  rule: z.string(),
  rationale: z.string().optional(),
});

export const PositioningTensionSchema = z.object({
  id: z.string(),
  tension: z.string().describe("e.g., 'breadth vs. specialization'"),
  default_lean: z.string().describe("Which way you usually lean, in plain language"),
  when_to_flip: z.string().describe("Signals from the job ad that flip the lean"),
});

export const LearnedPreferenceSchema = z.object({
  id: z.string(),
  observation: z.string(),
  source_application_ids: z.array(z.string()).default([]),
  confidence: z.enum(["proposed", "confirmed"]).default("proposed"),
  created_at: z.string(),
});

export const EducationSchema = z.object({
  id: z.string(),
  institution: z.string(),
  degree: z.string(),
  period: z.string(),
  focus: z.string().optional(),
});

export const CertificationSchema = z.object({
  id: z.string(),
  name: z.string(),
  issuer: z.string().optional(),
});

export const SkillGroupSchema = z.object({
  category: z.string().describe("e.g., 'Operations & Delivery'"),
  items: z.array(z.string()),
});

export const MasterProfileSchema = z.object({
  name: z.string(),
  headline: z.string().describe("One-line professional headline"),
  profile_summary: z.string().describe("3-5 sentence narrative summary used as CV profile section"),
  contact: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
    location: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
  }),
  experience_blocks: z.array(ExperienceBlockSchema),
  proof_library: z.array(ProofPointSchema),
  tone_rules: z.array(ToneRuleSchema),
  positioning_tensions: z.array(PositioningTensionSchema),
  education: z.array(EducationSchema).default([]),
  certifications: z.array(CertificationSchema).default([]),
  skills_taxonomy: z.array(SkillGroupSchema).default([]),
  languages: z.array(z.string()).default([]),
  learned_preferences: z.array(LearnedPreferenceSchema).default([]),
});

export type ExperienceBlock = z.infer<typeof ExperienceBlockSchema>;
export type ProofPoint = z.infer<typeof ProofPointSchema>;
export type ToneRule = z.infer<typeof ToneRuleSchema>;
export type PositioningTension = z.infer<typeof PositioningTensionSchema>;
export type LearnedPreference = z.infer<typeof LearnedPreferenceSchema>;
export type Education = z.infer<typeof EducationSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;
export type MasterProfile = z.infer<typeof MasterProfileSchema>;

export const RequirementSchema = z.object({
  id: z.string(),
  text: z.string(),
  kind: z.enum(["must_have", "nice_to_have", "implicit_signal"]),
  match_status: z.enum(["strong", "partial_reframeable", "gap"]),
  reasoning: z.string(),
  proof_point_ids: z.array(z.string()).default([]),
});

export const StrategicBriefSchema = z.object({
  job_summary: z.string().describe("2-3 sentence summary of the role and company context"),
  requirements: z.array(RequirementSchema),
  lead_with: z.array(z.string()).describe("Top 2-3 framings to emphasize"),
  reframe: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        reason: z.string(),
      })
    )
    .describe("Experience to reframe and how"),
  do_not_fake: z.array(z.string()).describe("Genuine gaps — do not paper over"),
  positioning_memo: z.string().describe("3-5 sentence narrative brief for this application"),
});

export type Requirement = z.infer<typeof RequirementSchema>;
export type StrategicBrief = z.infer<typeof StrategicBriefSchema>;
