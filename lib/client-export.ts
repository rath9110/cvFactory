import type { CoverLetter, CVVariant } from "./profile-types";

/**
 * Browser-side helpers for the two export paths. Both post to /api/export;
 * the difference is what the browser does with the response.
 */

export type ExportSubject =
  | { letter: CoverLetter }
  | { variant: CVVariant };

async function postExport(
  subject: ExportSubject,
  format: "doc" | "print",
  filename?: string
): Promise<Response> {
  const res = await fetch("/api/export", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...subject, format, ...(filename && { filename }) }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Export failed (${res.status})`);
  }
  return res;
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Downloads a .doc file that Word, Pages and Google Docs all open. */
export async function downloadWordDocument(
  subject: ExportSubject,
  filename: string
): Promise<void> {
  const res = await postExport(subject, "doc", filename);
  triggerDownload(await res.blob(), filename);
}

/**
 * Opens a print-ready view and raises the print dialog, where the viewer picks
 * "Save as PDF". The window is opened synchronously inside the click handler —
 * opening it after the await would be swallowed by the pop-up blocker.
 */
export async function openPdfPrintView(subject: ExportSubject): Promise<void> {
  const win = window.open("", "_blank");
  if (!win) {
    throw new Error("Pop-up blocked — allow pop-ups for this site to export PDF.");
  }
  win.document.write(
    "<!doctype html><title>Preparing…</title><p style=\"font:14px system-ui;padding:24px\">Preparing document…</p>"
  );

  let html: string;
  try {
    html = await (await postExport(subject, "print")).text();
  } catch (err) {
    win.close();
    throw err;
  }

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  // Let the new document lay out before raising the dialog.
  window.setTimeout(() => {
    try {
      win.print();
    } catch {
      // The page carries its own "Print / Save as PDF" button as a fallback.
    }
  }, 400);
}
