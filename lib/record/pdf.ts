import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launchBrowser } from "@/lib/cv/browser";
import { esc } from "@/lib/cv/document";
import { qrDataUri } from "@/lib/cv/qr";
import { academicYearLabel, KIND_LABELS } from "@/lib/record/constants";
import type { RecordKind } from "@/lib/record/types";
import { formatCode } from "@/supabase/functions/_shared/cv/sign.ts";

/**
 * The Record's PDFs (PRD 5.30): a certificate for one entry and a transcript of every entry the
 * student shows. Spectral for the heading, Space Grotesk for the text, JetBrains Mono for codes,
 * all embedded (Chromium on Vercel has no system fonts). Real selectable text, so each code on a
 * transcript can be read back and checked at /verify/[code]. Printed by the same headless
 * Chromium as CV PDFs (lib/cv/browser.ts).
 */
export interface PdfEntry {
  kind: RecordKind;
  title: string;
  issuerName: string;
  line: string;
  dateLabel: string;
  code: string;
  academicYear: number;
}

const FONTS: [family: string, weight: string, file: string][] = [
  ["Spectral", "600", "spectral-latin-600-normal.woff2"],
  ["Space Grotesk", "300 700", "space-grotesk-latin-variable.woff2"],
  ["JetBrains Mono", "400", "jetbrains-mono-latin-400-normal.woff2"],
];

let fontCss: string | null = null;
function fonts(): string {
  fontCss ??= FONTS.map(([family, weight, file]) => {
    const data = readFileSync(join(process.cwd(), "lib", "cv", "fonts", file)).toString("base64");
    return `@font-face { font-family: "${family}"; font-weight: ${weight}; font-style: normal; src: url(data:font/woff2;base64,${data}) format("woff2"); }`;
  }).join("\n");
  return fontCss;
}

const CSS = `
html, body { margin: 0; background: #fff; color: #0E0D0B; }
body { font-family: "Space Grotesk", sans-serif; font-size: 10.5pt; line-height: 1.45; font-variant-ligatures: none; }
h1, h2 { font-family: "Spectral", serif; font-weight: 600; margin: 0; }
h1 { font-size: 26pt; line-height: 1.1; }
h2 { font-size: 13pt; margin: 18pt 0 6pt; padding-bottom: 3pt; border-bottom: 0.75pt solid #C03910; }
.mono { font-family: "JetBrains Mono", monospace; font-size: 9pt; }
.muted { color: #4A4740; }
.kicker { text-transform: uppercase; letter-spacing: 0.12em; font-size: 8.5pt; font-weight: 600; color: #9C3713; }
.row { display: grid; grid-template-columns: 1fr auto; gap: 2pt 12pt; padding: 6pt 0; border-bottom: 0.5pt solid #D9D3C7; break-inside: avoid; }
.row p { margin: 0; }
.title { font-weight: 600; }
footer { display: flex; gap: 12pt; align-items: center; margin-top: 24pt; padding-top: 10pt; border-top: 0.75pt solid #0E0D0B; font-size: 9pt; }
footer img { width: 72pt; height: 72pt; }
.cert { border: 1.5pt solid #0E0D0B; padding: 36pt; min-height: 220mm; display: flex; flex-direction: column; gap: 14pt; }
.cert .what { font-size: 16pt; font-weight: 600; }
.cert .name { font-family: "Spectral", serif; font-size: 22pt; font-weight: 600; }
`;

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${fonts()}\n${CSS}</style></head><body>${body}</body></html>`;
}

export function verifyLink(siteUrl: string, path: string): string {
  return `${siteUrl.replace(/\/$/, "")}${path}`;
}

export async function certificateHtml(input: { holder: string; university: string; entry: PdfEntry; siteUrl: string }): Promise<string> {
  const e = input.entry;
  const url = verifyLink(input.siteUrl, `/verify/${e.code}`);
  const qr = await qrDataUri(url);
  return page(
    `${input.holder}: ${e.title}`,
    `<div class="cert">
      <p class="kicker">The Record · ${esc(KIND_LABELS[e.kind])}</p>
      <h1>Certificate</h1>
      <p class="muted">This certifies that</p>
      <p class="name">${esc(input.holder)}</p>
      <p class="muted">${esc(input.university)}</p>
      <p class="what">${esc(e.title)}</p>
      <p>Issued by ${esc(e.issuerName)} on Skilient · ${esc(e.dateLabel)}</p>
      ${e.line ? `<p class="muted">${esc(e.line)}</p>` : ""}
      <footer>
        <img src="${qr}" alt="">
        <div><p>Signed by Skilient. Check it at <span class="mono">${esc(url)}</span></p>
        <p>Code <span class="mono">${esc(formatCode(e.code))}</span></p></div>
      </footer>
    </div>`,
  );
}

export async function transcriptHtml(input: {
  holder: string;
  university: string;
  department: string | null;
  entries: PdfEntry[];
  exportId: string;
  issuedLabel: string;
  siteUrl: string;
}): Promise<string> {
  const url = verifyLink(input.siteUrl, `/verify/transcript/${input.exportId}`);
  const qr = await qrDataUri(url);
  const years = new Map<number, PdfEntry[]>();
  for (const e of input.entries) years.set(e.academicYear, [...(years.get(e.academicYear) ?? []), e]);
  const sections = [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(
      ([year, list]) =>
        `<h2>${esc(academicYearLabel(year))}</h2>` +
        list
          .map(
            (e) => `<div class="row">
              <p class="title">${esc(KIND_LABELS[e.kind])}: ${esc(e.title)}</p><p class="muted">${esc(e.dateLabel)}</p>
              <p class="muted">${esc(e.issuerName)}${e.line ? ` · ${esc(e.line)}` : ""}</p><p class="mono">${esc(e.code)}</p>
            </div>`,
          )
          .join(""),
    )
    .join("");
  return page(
    `${input.holder}: The Record`,
    `<p class="kicker">Co-curricular transcript</p>
     <h1>${esc(input.holder)}</h1>
     <p class="muted">${esc(input.university)}${input.department ? ` · ${esc(input.department)}` : ""} · issued ${esc(input.issuedLabel)}</p>
     ${sections}
     <footer>
       <img src="${qr}" alt="">
       <div><p>Every entry is signed by Skilient. Check this transcript at <span class="mono">${esc(url)}</span>,
       or any entry by its code at ${esc(input.siteUrl.replace(/^https?:\/\//, "").replace(/\/$/, ""))}/verify.</p></div>
     </footer>`,
  );
}

export async function renderRecordPdf(html: string): Promise<Uint8Array> {
  const browser = await launchBrowser();
  try {
    const p = await browser.newPage();
    await p.setContent(html, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready.then(() => true));
    const pdf = await p.pdf({ format: "A4", printBackground: true, margin: { top: "16mm", bottom: "16mm", left: "16mm", right: "16mm" }, tagged: true });
    return new Uint8Array(pdf);
  } finally {
    await browser.close();
  }
}
