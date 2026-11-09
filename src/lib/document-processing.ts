import { extractTextFromImage, extractTextFromImages } from "@/lib/ocr";
import { createCanvas, DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";

export interface ExtractedPage {
  pageNumber: number;
  text: string;
  ocr?: boolean;
}

export interface ExtractedDoc {
  text: string;
  pageCount?: number;
  headings?: string[];
  pages?: ExtractedPage[];
}

export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\x00/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string, chunkSize = 900, overlap = 150): { content: string; heading?: string }[] {
  if (!Number.isInteger(chunkSize) || !Number.isInteger(overlap) || chunkSize <= 0 || overlap < 0 || overlap >= chunkSize) {
    throw new RangeError("chunkSize must be a positive integer and overlap must be a non-negative integer smaller than chunkSize.");
  }
  if (!text || text.trim().length === 0) return [];
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const chunks: { content: string; heading?: string }[] = [];
  let current = "";
  let currentHeading: string | undefined;
  const headingRegex = /^(#{1,6}\s.+|[A-Z][A-Z\s]{3,}:?|.+\n[=-]{3,})$/m;
  for (const para of paragraphs) {
    const trimmed = para.trim();
    const titleCaseHeading = /^[A-Z0-9][A-Za-z0-9'’:-]*(?:\s+(?:[A-Z0-9][A-Za-z0-9'’:-]*|of|and|to|for|in|on|the|a|an|with|by|from|as|at))*$/.test(trimmed);
    const isHeading = para.length < 120 && (headingRegex.test(trimmed) || (trimmed.length < 80 && titleCaseHeading));
    if (isHeading && para.trim().length < 80) {
      if (current.trim()) chunks.push({ content: current.trim(), heading: currentHeading });
      current = "";
      currentHeading = trimmed.replace(/^#{1,6}\s+/, "");
      continue;
    }

    if (para.length > chunkSize) {
      if (current.trim()) chunks.push({ content: current.trim(), heading: currentHeading });
      current = "";
      let start = 0;
      while (start < para.length) {
        let end = Math.min(start + chunkSize, para.length);
        if (end < para.length) {
          const boundary = para.lastIndexOf(" ", end);
          if (boundary > start + chunkSize * 0.6) end = boundary;
        }
        chunks.push({ content: para.slice(start, end).trim(), heading: currentHeading });
        if (end >= para.length) break;
        start = Math.max(start + 1, end - overlap);
        while (para[start] === " ") start += 1;
      }
      continue;
    }

    if (current && (current + "\n\n" + para).length > chunkSize) {
      chunks.push({ content: current.trim(), heading: currentHeading });
      const carryLength = Math.min(overlap, Math.max(0, chunkSize - para.length - 2));
      current = carryLength ? `${current.slice(-carryLength)}\n\n${para}` : para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim()) chunks.push({ content: current.trim(), heading: currentHeading });
  return chunks.filter(c => c.content.length > 20);
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkPages(pages: ExtractedPage[], chunkSize = 900, overlap = 150): { content: string; heading?: string; pageNumber: number; ocr?: boolean }[] {
  return pages.flatMap((page) =>
    chunkText(page.text, chunkSize, overlap).map((chunk) => ({
      ...chunk,
      heading: page.ocr ? [chunk.heading, "OCR extracted"].filter(Boolean).join(" · ") : chunk.heading,
      pageNumber: page.pageNumber,
      ocr: page.ocr,
    })),
  );
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height?: number;
}

export function layoutPdfTextItems(items: PdfTextItem[]): { text: string; heading?: string }[] {
  const rows: { y: number; items: PdfTextItem[] }[] = [];

  for (const item of items.filter((entry) => entry.str.trim())) {
    const y = item.transform[5] ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 3);
    if (!row) {
      row = { y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  const lines = rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = row.items.sort((a, b) => (a.transform[4] ?? 0) - (b.transform[4] ?? 0));
      let text = "";
      let previousEnd = 0;
      for (const [index, item] of sorted.entries()) {
        const x = item.transform[4] ?? 0;
        const gap = x - previousEnd;
        if (index > 0) text += gap > 24 ? " | " : " ";
        text += item.str.trim();
        previousEnd = x + item.width;
      }
      return { text: text.trim(), fontSize: Math.max(...sorted.map((item) => item.height ?? item.transform[3] ?? 0), 0) };
    })
    .filter((line) => line.text);

  const fontSizes = lines.map((line) => line.fontSize).filter((size) => size > 0).sort((a, b) => a - b);
  const medianFontSize = fontSizes[Math.floor(fontSizes.length / 2)] ?? 0;
  let heading: string | undefined;

  return lines.map((line) => {
    const isHeading = medianFontSize > 0
      && line.fontSize >= medianFontSize * 1.3
      && line.text.length <= 120
      && !/[.!?]$/.test(line.text);
    if (isHeading) heading = line.text;
    return { text: isHeading ? `# ${line.text}` : line.text, heading };
  });
}

export function formatPdfLayout(lines: Array<{ text: string }>): string {
  return lines.map((line) => line.text.startsWith("# ") ? `\n\n${line.text}\n\n` : line.text).join("\n");
}

async function extractPdfPages(arrayBuf: ArrayBuffer): Promise<{ pages: ExtractedPage[]; pageCount: number }> {
  Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuf), verbosity: 0 });
  const pdf = await loadingTask.promise;
  const pages: ExtractedPage[] = [];
  const ocrPages: { pageNumber: number; image: Buffer }[] = [];
  const pageCount = pdf.numPages;

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const layout = layoutPdfTextItems(content.items.filter((item): item is typeof item & PdfTextItem => "str" in item));
      let text = formatPdfLayout(layout);

      if (text.trim().length < 20) {
        const viewport = page.getViewport({ scale: 1.75 });
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");
        await page.render({ canvas: canvas as never, canvasContext: context as never, viewport }).promise;
        ocrPages.push({ pageNumber, image: canvas.toBuffer("image/png") });
      }

      pages.push({ pageNumber, text: cleanText(text) });
      page.cleanup();
    }
    if (ocrPages.length) {
      const recognized = await extractTextFromImages(ocrPages.map((entry) => entry.image));
      for (const [index, ocrText] of recognized.entries()) {
        if (!ocrText) continue;
        const page = pages.find((candidate) => candidate.pageNumber === ocrPages[index].pageNumber);
        if (page) {
          page.text = cleanText(ocrText);
          page.ocr = true;
        }
      }
      }
  } finally {
      await loadingTask.destroy();
  }

  return { pages: pages.filter((page) => page.text), pageCount };
}

export async function extractTextFromFile(file: File | { arrayBuffer: () => Promise<ArrayBuffer>, type: string, name: string }): Promise<ExtractedDoc> {
  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const filename = ((file as any).name || "document").toLowerCase();
  const mimeType = ((file as any).type || "").toLowerCase();

  if (mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes("." + filename.split(".").pop()?.toLowerCase())) {
    const ocrText = await extractTextFromImage(buffer);
    if (!ocrText.trim()) throw new Error("No text detected in the image using OCR.");
    const text = cleanText(ocrText);
    return { text, pageCount: 1, pages: [{ pageNumber: 1, text, ocr: true }] };
  }
  
  // TXT - check extension first
  if (mimeType.includes("text/plain") || filename.endsWith(".txt") || mimeType.startsWith("text/")) {
    // For .txt we try utf8, but also handle fallback
    let text = "";
    try { text = buffer.toString("utf-8"); } catch { text = Buffer.from(arrayBuf).toString("utf-8"); }
    if (!text.trim()) throw new Error("Text file is empty or unreadable");
    return { text: cleanText(text), pageCount: 1 };
  }
  
  // DOCX
  if (mimeType.includes("officedocument.wordprocessingml") || filename.endsWith(".docx") || mimeType.includes("msword")) {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      if (!result.value || result.value.trim().length < 5) throw new Error("No text found in DOCX");
      return { text: cleanText(result.value), pageCount: 1 };
    } catch (e: any) {
      throw new Error("Failed to extract DOCX text: " + e.message);
    }
  }
  
  // PDF - try multiple strategies
  if (mimeType.includes("pdf") || filename.endsWith(".pdf") || mimeType === "application/octet-stream") {
    try {
      const { pages, pageCount } = await extractPdfPages(arrayBuf);
      const text = pages.map((page) => page.text).join("\n\n");
      if (text.trim().length >= 10) return { text, pageCount, pages };
    } catch (error) {
      console.error("PDF text and OCR extraction failed:", error);
      throw new Error("Could not read this PDF. It may be encrypted, corrupted, or contain pages that could not be OCR-processed.");
    }

    throw new Error("No readable text was found in the PDF, including after OCR. Check that the pages are legible and not password-protected.");
  }
  
  throw new Error(`Unsupported file type: ${mimeType || filename}. Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP`);
}

export function validateFile(file: File): string | null {
  const maxSize = 15 * 1024 * 1024; // 15MB
  const allowedExts = [".pdf", ".docx", ".txt", ".png", ".jpg", ".jpeg", ".webp"];
  
  if (!file || !file.name) return "Invalid file object";
  if (file.size === 0) return "File is empty (0 bytes)";
  if (file.size > maxSize) return `File too large (${(file.size/1024/1024).toFixed(1)}MB). Maximum is 15MB`;
  
  const lowerName = file.name.toLowerCase();
  const ext = "." + lowerName.split(".").pop();
  if (!allowedExts.includes(ext) && !file.type.startsWith("image/")) {
    return `Unsupported file type: ${ext}. Allowed: PDF, DOCX, TXT, PNG, JPG, JPEG, WEBP`;
  }
  return null;
}
