import type { CVVariant, ExperienceBlock } from "./profile-types";

/**
 * Estimates how many pages a CV variant will occupy once rendered.
 *
 * Deterministic arithmetic over character counts, calibrated to the LaTeX
 * template in `latex-template.ts`: A4, 10pt, 1.8cm margins. That geometry gives
 * roughly 95 characters to a line and about 58 lines to a page.
 *
 * It is an estimate, not a renderer — the true figure depends on hyphenation and
 * the exact font. Close enough to answer the only question that matters while
 * editing: is this one page, or is it quietly becoming three?
 */

const CHARS_PER_LINE = 95;
/** Bullets are indented, so they wrap sooner. */
const CHARS_PER_BULLET_LINE = 90;
const LINES_PER_PAGE = 58;

/** Header: name, contact line, and the space under them. */
const HEADER_LINES = 4;
/** A section heading plus its rule and the space around it. */
const SECTION_HEADING_LINES = 3;
/** Role title line, plus the gap before the next entry. */
const JOB_HEADER_LINES = 2;

function wrapped(text: string, perLine: number): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return Math.ceil(trimmed.length / perLine);
}

export type BlockLength = {
  block_id: string;
  role: string;
  lines: number;
  bullet_count: number;
};

export type CvLengthEstimate = {
  lines: number;
  pages: number;
  blocks: BlockLength[];
  /** The block contributing the most lines — the first place to cut. */
  longest: BlockLength | null;
};

export function estimateCvLength(
  variant: CVVariant,
  profile: {
    experience_blocks: ExperienceBlock[];
    education: unknown[];
    certifications: unknown[];
    languages: unknown[];
  }
): CvLengthEstimate {
  const blockById = new Map(profile.experience_blocks.map((b) => [b.id, b]));

  let lines = HEADER_LINES;

  // Profile section.
  lines += SECTION_HEADING_LINES + wrapped(variant.profile_summary, CHARS_PER_LINE);

  // Experience section.
  lines += SECTION_HEADING_LINES;
  const blocks: BlockLength[] = [];
  for (const id of variant.experience_order) {
    const source = blockById.get(id);
    const entry = variant.experience.find((e) => e.block_id === id);
    if (!source || !entry) continue;

    let blockLines = JOB_HEADER_LINES + wrapped(source.context, CHARS_PER_LINE);
    for (const bullet of entry.bullets) {
      blockLines += wrapped(bullet, CHARS_PER_BULLET_LINE);
    }

    blocks.push({
      block_id: id,
      role: source.role,
      lines: blockLines,
      bullet_count: entry.bullets.length,
    });
    lines += blockLines;
  }

  // Trailing sections are rendered straight from the profile, not the variant.
  if (profile.education.length > 0) {
    lines += SECTION_HEADING_LINES + profile.education.length * 2;
  }
  if (profile.certifications.length > 0) lines += SECTION_HEADING_LINES + 1;
  if (variant.skills.length > 0 || profile.languages.length > 0) {
    lines +=
      SECTION_HEADING_LINES +
      variant.skills.length +
      (profile.languages.length > 0 ? 1 : 0);
  }

  const longest = blocks.reduce<BlockLength | null>(
    (worst, b) => (worst === null || b.lines > worst.lines ? b : worst),
    null
  );

  return {
    lines,
    pages: Math.round((lines / LINES_PER_PAGE) * 10) / 10,
    blocks,
    longest,
  };
}

/** How an estimate should read to someone deciding whether to cut. */
export function lengthVerdict(pages: number): {
  label: string;
  tone: "good" | "warn" | "bad";
} {
  if (pages <= 1.05) return { label: "fits one page", tone: "good" };
  if (pages <= 1.35) return { label: "just over one page", tone: "warn" };
  if (pages <= 2.05) return { label: "fits two pages", tone: "good" };
  return { label: "over two pages", tone: "bad" };
}
