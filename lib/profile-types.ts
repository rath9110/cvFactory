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

export const BridgeParagraphSchema = z.object({
  text: z.string(),
  proof_point_ids: z
    .array(z.string())
    .default([])
    .describe("Proof points from the master profile referenced in this paragraph"),
});

export const CoverLetterSchema = z.object({
  recipient: z
    .string()
    .optional()
    .describe("Hiring team / specific person if inferable from the ad, else omit"),
  opening: z
    .string()
    .describe("Genuine connection point — why this company, why now. Not filler."),
  bridge: z
    .array(BridgeParagraphSchema)
    .describe("1-3 paragraphs bridging candidate experience to the role's specific needs"),
  gap_acknowledgement: z
    .string()
    .optional()
    .describe(
      "Transparent acknowledgement of a genuine gap, framed via adjacent experience. Omit if no gap warrants it."
    ),
  closing: z.string().describe("Concrete forward statement — what comes next"),
  signoff: z.string().describe("e.g., 'Best regards, Rasmus Thunberg'"),
});

export const ANNOTATION_ISSUES = [
  "unsupported_claim",
  "generic_platitude",
  "drift_from_brief",
  "tone_mismatch",
  "voice_unnatural",
  "good",
] as const;

export const AnnotationSchema = z.object({
  target_section: z.enum(["opening", "bridge", "gap_acknowledgement", "closing"]),
  target_text: z
    .string()
    .describe("The exact substring being annotated (so the UI can locate it)"),
  issue: z.enum(ANNOTATION_ISSUES),
  note: z.string().describe("One-line explanation of the issue or strength"),
  suggested_rewrite: z
    .string()
    .optional()
    .describe("Concrete rewrite. Only for non-'good' issues."),
});

export const CritiqueScoresSchema = z.object({
  relevance: z.number().min(1).max(10).describe("Alignment with the strategic brief"),
  specificity: z.number().min(1).max(10).describe("Concrete vs generic"),
  honesty: z
    .number()
    .min(1)
    .max(10)
    .describe("Claims supported by the proof library / profile; no overselling"),
  tone_fit: z.number().min(1).max(10).describe("Adherence to tone_rules"),
});

export const CritiqueSchema = z.object({
  scores: CritiqueScoresSchema,
  annotations: z.array(AnnotationSchema),
  verdict: z
    .string()
    .describe("2-3 sentence overall verdict and the single most important thing to fix"),
});

export type BridgeParagraph = z.infer<typeof BridgeParagraphSchema>;
export type CoverLetter = z.infer<typeof CoverLetterSchema>;
export type Annotation = z.infer<typeof AnnotationSchema>;
export type AnnotationIssue = (typeof ANNOTATION_ISSUES)[number];
export type CritiqueScores = z.infer<typeof CritiqueScoresSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;

export const ANNOTATION_RESPONSES = ["accept", "reject", "ignore"] as const;

export const AnnotationResponseSchema = z.object({
  annotation_target_text: z
    .string()
    .describe("Matches Annotation.target_text — used as the key"),
  annotation_section: z.enum(["opening", "bridge", "gap_acknowledgement", "closing"]),
  response: z.enum(ANNOTATION_RESPONSES),
  comment: z.string().optional(),
});

export const SectionCommentsSchema = z.object({
  opening: z.string().default(""),
  bridge: z.array(z.string()).default([]),
  gap_acknowledgement: z.string().default(""),
  closing: z.string().default(""),
});

export const OVERALL_VERDICTS = ["worked", "felt_off"] as const;

export const FeedbackBlockSchema = z.object({
  overall_verdict: z.enum(OVERALL_VERDICTS).nullable().default(null),
  overall_comment: z.string().default(""),
  annotation_responses: z.array(AnnotationResponseSchema).default([]),
  section_comments: SectionCommentsSchema.default({
    opening: "",
    bridge: [],
    gap_acknowledgement: "",
    closing: "",
  }),
  pattern_flags: z
    .array(z.string())
    .default([])
    .describe(
      "Free-text rules the user wants applied across future applications — e.g., 'never claim deep ML expertise'. These become proposed learned_preferences in Phase 4."
    ),
});

export const ApplicationSessionSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  job_ad: z.string(),
  brief: StrategicBriefSchema,
  letter_generated: CoverLetterSchema,
  letter_edited: CoverLetterSchema,
  critique: CritiqueSchema,
  feedback: FeedbackBlockSchema,
});

export type AnnotationResponseValue = (typeof ANNOTATION_RESPONSES)[number];
export type AnnotationResponse = z.infer<typeof AnnotationResponseSchema>;
export type SectionComments = z.infer<typeof SectionCommentsSchema>;
export type OverallVerdict = (typeof OVERALL_VERDICTS)[number];
export type FeedbackBlock = z.infer<typeof FeedbackBlockSchema>;
export type ApplicationSession = z.infer<typeof ApplicationSessionSchema>;
