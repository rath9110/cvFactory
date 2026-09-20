import { CoverLetter, CVVariant, MasterProfile } from "./profile-types";

/**
 * Renders the generated artefacts as HTML for two destinations:
 *   - Word (.doc): an HTML document carrying the Office namespaces Word needs to
 *     open it as a real document (editable headings, bullets, page setup).
 *   - Print: the same body wrapped in a page that opens the browser's print
 *     dialog, where "Save as PDF" produces a true vector PDF.
 * Both share one stylesheet so the exports look identical, and both mirror the
 * visual identity of lib/latex-template.ts.
 */

const HEAD_BLUE = "#1F4E79";
const DARK_TEXT = "#1A1A1A";
const GRAY_TEXT = "#555555";
const LIGHT_GRAY = "#888888";

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nonEmpty(s: string | undefined | null): string {
  return (s ?? "").trim();
}

/** Escape, then turn hard newlines into <br> — used for signoffs. */
function escapeMultiline(input: string): string {
  return escapeHtml(input).replace(/\r?\n/g, "<br />");
}

const SHARED_CSS = `
  @page { size: A4; margin: 1.8cm; }
  body {
    font-family: Calibri, Carlito, "Segoe UI", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.45;
    color: ${DARK_TEXT};
    margin: 0;
  }
  .doc-name {
    font-size: 24pt;
    font-weight: bold;
    color: ${HEAD_BLUE};
    margin: 0 0 4pt 0;
  }
  .doc-contact { font-size: 9pt; color: ${GRAY_TEXT}; margin: 0 0 14pt 0; }
  .doc-contact a { color: ${HEAD_BLUE}; text-decoration: none; }
  h2.section {
    font-size: 11pt;
    font-weight: bold;
    color: ${HEAD_BLUE};
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid ${HEAD_BLUE};
    padding-bottom: 2pt;
    margin: 16pt 0 6pt 0;
  }
  .job-header { margin: 10pt 0 0 0; }
  .job-role { font-weight: bold; color: ${DARK_TEXT}; }
  .job-sep { color: ${LIGHT_GRAY}; }
  .job-company { font-style: italic; color: ${GRAY_TEXT}; }
  .job-context { color: ${GRAY_TEXT}; margin: 2pt 0 0 0; }
  ul { margin: 4pt 0 0 0; padding-left: 16pt; }
  li { margin-bottom: 2pt; }
  p { margin: 0 0 9pt 0; }
  table.grid { width: 100%; border-collapse: collapse; }
  table.grid td { vertical-align: top; padding: 0 0 4pt 0; }
  td.label { font-weight: bold; color: ${DARK_TEXT}; white-space: nowrap; padding-right: 10pt; }
  td.right { text-align: right; color: ${LIGHT_GRAY}; font-size: 9pt; white-space: nowrap; }
  .letter-date { color: ${GRAY_TEXT}; margin: 0 0 14pt 0; }
  .letter-recipient { margin: 0 0 12pt 0; }
  .letter-signoff { margin-top: 14pt; }
`;

function contactLine(profile: MasterProfile): string {
  const pieces: string[] = [];
  const { location, phone, email, linkedin, github } = profile.contact;
  if (nonEmpty(location)) pieces.push(escapeHtml(location!));
  if (nonEmpty(phone)) pieces.push(escapeHtml(phone!));
  if (nonEmpty(email))
    pieces.push(`<a href="mailto:${escapeHtml(email!)}">${escapeHtml(email!)}</a>`);
  if (nonEmpty(linkedin))
    pieces.push(
      `<a href="https://${escapeHtml(linkedin!)}">${escapeHtml(linkedin!)}</a>`
    );
  if (nonEmpty(github))
    pieces.push(
      `<a href="https://${escapeHtml(github!)}">${escapeHtml(github!)}</a>`
    );
  return pieces.join(" &bull; ");
}

function letterhead(profile: MasterProfile): string {
  return `<div class="doc-name">${escapeHtml(profile.name)}</div>
<div class="doc-contact">${contactLine(profile)}</div>`;
}

export function renderCoverLetterBody(
  letter: CoverLetter,
  profile: MasterProfile,
  opts: { date?: Date } = {}
): string {
  const date = (opts.date ?? new Date()).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const paragraphs: string[] = [letter.opening];
  for (const b of letter.bridge) paragraphs.push(b.text);
  if (nonEmpty(letter.gap_acknowledgement))
    paragraphs.push(letter.gap_acknowledgement!);
  paragraphs.push(letter.closing);

  const body = paragraphs
    .filter((p) => nonEmpty(p))
    .map((p) => `<p>${escapeMultiline(p.trim())}</p>`)
    .join("\n");

  const recipient = nonEmpty(letter.recipient)
    ? `<div class="letter-recipient">${escapeHtml(letter.recipient!)}</div>`
    : "";

  return `${letterhead(profile)}
<div class="letter-date">${escapeHtml(date)}</div>
${recipient}
${body}
<div class="letter-signoff">${escapeMultiline(letter.signoff)}</div>`;
}

export function renderCVBody(variant: CVVariant, profile: MasterProfile): string {
  const blockById = new Map(profile.experience_blocks.map((b) => [b.id, b]));

  const experience = variant.experience_order
    .map((id) => {
      const block = blockById.get(id);
      const variantBlock = variant.experience.find((e) => e.block_id === id);
      if (!block || !variantBlock) return "";

      const bullets = variantBlock.bullets
        .filter((b) => nonEmpty(b))
        .map((b) => `    <li>${escapeHtml(b)}</li>`)
        .join("\n");

      const context = nonEmpty(block.context)
        ? `<p class="job-context">${escapeHtml(block.context)}</p>`
        : "";

      return `<table class="grid job-header"><tr>
  <td><span class="job-role">${escapeHtml(block.role)}</span> <span class="job-sep">|</span> <span class="job-company">${escapeHtml(block.company)}</span></td>
  <td class="right">${escapeHtml(block.period)}</td>
</tr></table>
${context}
<ul>
${bullets}
</ul>`;
    })
    .filter((s) => s.length > 0)
    .join("\n");

  const education = profile.education
    .map(
      (e) => `<tr>
  <td><strong>${escapeHtml(e.degree)}</strong><br /><span class="job-company">${escapeHtml(e.institution)}</span>${
    nonEmpty(e.focus)
      ? `<br /><span class="job-context">${escapeHtml(e.focus!)}</span>`
      : ""
  }</td>
  <td class="right">${escapeHtml(e.period)}</td>
</tr>`
    )
    .join("\n");

  const certifications = profile.certifications
    .map((c) => escapeHtml(c.name))
    .join(" &bull; ");

  const skillRows = variant.skills
    .map(
      (g) => `<tr>
  <td class="label">${escapeHtml(g.category)}</td>
  <td>${g.items.map((i) => escapeHtml(i)).join(", ")}</td>
</tr>`
    )
    .join("\n");

  const languageRow = profile.languages.length
    ? `<tr>
  <td class="label">Languages</td>
  <td>${profile.languages.map((l) => escapeHtml(l)).join(", ")}</td>
</tr>`
    : "";

  const educationSection = education
    ? `\n<h2 class="section">Education</h2>\n<table class="grid">\n${education}\n</table>`
    : "";
  const certificationSection = certifications
    ? `\n<h2 class="section">Certifications</h2>\n<p>${certifications}</p>`
    : "";
  const skillsSection =
    skillRows || languageRow
      ? `\n<h2 class="section">Skills &amp; Tools</h2>\n<table class="grid">\n${skillRows}\n${languageRow}\n</table>`
      : "";

  return `${letterhead(profile)}
<h2 class="section">Profile</h2>
<p>${escapeHtml(variant.profile_summary)}</p>

<h2 class="section">Experience</h2>
${experience}
${educationSection}
${certificationSection}
${skillsSection}`;
}

/** HTML that Word opens as a document rather than as a web page. */
export function wordDocument(title: string, body: string): string {
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
<style>${SHARED_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Print-optimised page; the browser's "Save as PDF" is the PDF exporter. */
export function printDocument(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
${SHARED_CSS}
  body { background: #f5f5f4; padding: 0; }
  .sheet {
    background: #fff;
    width: 21cm;
    min-height: 29.7cm;
    box-sizing: border-box;
    padding: 1.8cm;
    margin: 24px auto;
    box-shadow: 0 1px 6px rgba(0,0,0,0.15);
  }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    background: #1c1917; color: #fff;
    padding: 10px 16px; font-size: 13px;
    display: flex; align-items: center; gap: 12px;
  }
  .toolbar button {
    font: inherit; cursor: pointer;
    background: #fff; color: #1c1917;
    border: 0; border-radius: 4px; padding: 5px 12px;
  }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <button type="button" onclick="window.print()">Print / Save as PDF</button>
  <span>Choose &ldquo;Save as PDF&rdquo; as the destination to get a PDF file.</span>
</div>
<div class="sheet">
${body}
</div>
</body>
</html>`;
}
