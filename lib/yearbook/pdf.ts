import "server-only";

import { esc } from "@/lib/cv/document";
import { fonts } from "@/lib/record/pdf";

/**
 * A yearbook page as a PDF keepsake (PRD 5.33): Spectral for the name and quote (a belief moment),
 * Space Grotesk for the notes. The photo is embedded as a data URI so nothing loads at print time.
 */
export interface YearbookPdfInput {
  name: string;
  subtitle: string;
  quote: string | null;
  photo: string | null;
  awards: string[];
  highlights: { title: string; issuer: string; dateLabel: string; code: string }[];
  notes: { body: string; writer: string; atLabel: string }[];
}

const CSS = `
html, body { margin: 0; background: #fff; color: #0E0D0B; }
body { font-family: "Space Grotesk", sans-serif; font-size: 10.5pt; line-height: 1.5; }
h1, .quote { font-family: "Spectral", serif; font-weight: 600; margin: 0; }
h1 { font-size: 28pt; line-height: 1.1; }
h2 { font-family: "Spectral", serif; font-size: 13pt; margin: 18pt 0 6pt; padding-bottom: 3pt; border-bottom: 0.75pt solid #C03910; }
.top { display: flex; gap: 18pt; align-items: center; }
.top img { width: 110pt; height: 110pt; border-radius: 55pt; object-fit: cover; }
.muted { color: #4A4740; }
.quote { font-style: italic; font-size: 16pt; margin: 16pt 0; }
.award { display: inline-block; border: 0.75pt solid #9C3713; color: #9C3713; border-radius: 10pt; padding: 1pt 8pt; margin: 4pt 4pt 0 0; font-size: 9pt; font-weight: 600; }
.note { border-bottom: 0.5pt solid #D9D3C7; padding: 8pt 0; break-inside: avoid; }
.note p { margin: 0 0 3pt; white-space: pre-wrap; }
.mono { font-family: "JetBrains Mono", monospace; font-size: 8.5pt; }
`;

export function yearbookPageHtml(p: YearbookPdfInput): string {
  const body = `
<div class="top">
  ${p.photo ? `<img src="${esc(p.photo)}" alt="">` : ""}
  <div>
    <h1>${esc(p.name)}</h1>
    <p class="muted">${esc(p.subtitle)}</p>
    ${p.awards.map((a) => `<span class="award">${esc(a)}</span>`).join("")}
  </div>
</div>
${p.quote ? `<p class="quote">“${esc(p.quote)}”</p>` : ""}
${p.highlights.length ? `<h2>From the Record</h2>${p.highlights.map((h) => `<p><strong>${esc(h.title)}</strong> · ${esc(h.issuer)} · <span class="mono">${esc(h.dateLabel)} · ${esc(h.code)}</span></p>`).join("")}` : ""}
<h2>Notes</h2>
${p.notes.length ? p.notes.map((n) => `<div class="note"><p>${esc(n.body)}</p><span class="muted">${esc(n.writer)} · <span class="mono">${esc(n.atLabel)}</span></span></div>`).join("") : `<p class="muted">No notes.</p>`}
`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(p.name)} · Yearbook</title><style>${fonts()}\n${CSS}</style></head><body>${body}</body></html>`;
}
