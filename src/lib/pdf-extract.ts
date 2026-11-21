// PDF text extraction, in the browser only.
// pdfjs-dist is loaded lazily (dynamic import) so the timetable page's
// first load never pays for it. The worker file is vendored at
// public/pdf.worker.min.mjs (copied from the pdfjs-dist package, same
// version) and served from the same origin — no CDN, so it works on the
// static export too. If pdfjs-dist is ever upgraded, copy the worker
// file again: cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/

import { appBasePath } from "./paths";

export interface PdfText {
  pages: number;
  text: string;
}

type TextItem = {
  str: string;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, x, y]
  hasEOL?: boolean;
};

/** Group text items into lines by their y position, then join lines. */
function itemsToLines(items: TextItem[]): string[] {
  const lines: { y: number; parts: { x: number; str: string }[] }[] = [];
  for (const item of items) {
    if (!item.str) continue;
    const y = Math.round(item.transform[5] * 10) / 10;
    const x = item.transform[4];
    let line = lines.find((l) => Math.abs(l.y - y) <= 2);
    if (item.hasEOL) line = undefined;
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, str: item.str });
  }
  // PDF y grows upward: top of the page first.
  lines.sort((a, b) => b.y - a.y);
  return lines.map((l) =>
    l.parts
      .sort((a, b) => a.x - b.x)
      .map((p) => p.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export async function extractPdfText(data: ArrayBuffer): Promise<PdfText> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = `${appBasePath()}/pdf.worker.min.mjs`;
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(itemsToLines(content.items as TextItem[]).join("\n"));
  }
  return { pages: doc.numPages, text: pages.join("\n") };
}
