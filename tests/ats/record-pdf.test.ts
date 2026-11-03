import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";
import { certificateHtml, renderRecordPdf, transcriptHtml, type PdfEntry } from "@/lib/record/pdf";

/**
 * PRD 5.30: the certificate and the transcript are real text, so every code on them can be read
 * back and checked at /verify/[code]; the transcript's QR link is printed too.
 */
async function textOf(pdf: Uint8Array): Promise<string> {
  const parser = new PDFParse({ data: Buffer.from(pdf) });
  try {
    return (await parser.getText()).text.replace(/\s+/g, " ");
  } finally {
    await parser.destroy();
  }
}

const ENTRIES: PdfEntry[] = [
  { kind: "office_bearer", title: "General Secretary", issuerName: "CS Society", line: "General Secretary · Sep 2025 – Jun 2026", dateLabel: "30 Jun 2026", code: "7RCD0K2M4P", academicYear: 2025 },
  { kind: "result", title: "Campus Hackathon", issuerName: "CS Society", line: "2nd of 14 teams", dateLabel: "15 Nov 2026", code: "7RCD0Q8T1W", academicYear: 2026 },
  { kind: "attended", title: "Build with React", issuerName: "CS Society", line: "Checked in 10:04", dateLabel: "12 Nov 2026", code: "7RCD0H3V9N", academicYear: 2026 },
];

describe("Record PDFs", () => {
  it("prints a certificate with the holder, the entry and its verify link as text", async () => {
    const pdf = await renderRecordPdf(await certificateHtml({ holder: "Ayesha Khan", university: "National University of Technology", entry: ENTRIES[1], siteUrl: "https://skilient.com" }));
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    const text = await textOf(pdf);
    expect(text).toContain("Ayesha Khan");
    expect(text).toContain("Campus Hackathon");
    expect(text).toContain("2nd of 14 teams");
    expect(text).toContain("7RCD0-Q8T1W");
    expect(text).toContain("https://skilient.com/verify/7RCD0Q8T1W");
  });

  it("prints a transcript grouped by academic year with every code", async () => {
    const pdf = await renderRecordPdf(
      await transcriptHtml({
        holder: "Ayesha Khan", university: "National University of Technology", department: "Computer Science", entries: ENTRIES,
        exportId: "00000000-0000-4000-8000-000000000001", issuedLabel: "3 Nov 2026", siteUrl: "https://skilient.com",
      }),
    );
    const text = await textOf(pdf);
    expect(text.indexOf("2026–27")).toBeLessThan(text.indexOf("2025–26"));
    for (const e of ENTRIES) expect(text).toContain(e.code);
    expect(text).toContain("https://skilient.com/verify/transcript/00000000-0000-4000-8000-000000000001");
  });
});
