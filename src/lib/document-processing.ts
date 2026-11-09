import { extractTextFromImage } from "@/lib/ocr";

export interface ExtractedDoc {
  text: string;
  pageCount?: number;
  headings?: string[];
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
      currentHeading = trimmed;
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

export async function extractTextFromFile(file: File | { arrayBuffer: () => Promise<ArrayBuffer>, type: string, name: string }): Promise<ExtractedDoc> {
  const arrayBuf = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const filename = ((file as any).name || "document").toLowerCase();
  const mimeType = ((file as any).type || "").toLowerCase();

  if (mimeType.startsWith("image/") || [".png", ".jpg", ".jpeg", ".webp"].includes("." + filename.split(".").pop()?.toLowerCase())) {
    const ocrText = await extractTextFromImage(buffer);
    if (!ocrText.trim()) throw new Error("No text detected in the image using OCR.");
    return { text: cleanText(ocrText), pageCount: 1 };
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
    // Strategy 1: unpdf (most reliable for server)
    try {
      const { extractText } = await import("unpdf");
      const result = await extractText(new Uint8Array(arrayBuf), { mergePages: true } as any);
      let text = "";
      let numPages = 1;
      if (typeof result.text === "string") text = result.text;
      else if (Array.isArray(result.text)) text = result.text.join("\n\n");
      else if ((result as any).totalPages) numPages = (result as any).totalPages;
      // unpdf returns { text, totalPages } - handle both shapes
      if ((result as any).totalPages) numPages = (result as any).totalPages;
      if (Array.isArray(text)) text = text.join("\n\n");
      if (!text || text.trim().length < 10) throw new Error("unpdf empty");
      return { text: cleanText(text as string), pageCount: numPages };
    } catch (e: any) {
      console.warn("unpdf failed, trying pdf-parse fallback:", e.message);
      // Continue to fallback
    }
    
    // Strategy 2: pdf-parse legacy / v2 with worker disabled attempt
    try {
      const pdfParseModule: any = await import("pdf-parse");
      let text = "";
      let numPages = 1;
      if (pdfParseModule.PDFParse) {
        try {
          const parser = new pdfParseModule.PDFParse({ data: new Uint8Array(arrayBuf) });
          const result = await parser.getText();
          text = result.text || "";
          numPages = result.numpages || result.numPages || result.totalPages || 1;
          if (typeof parser.destroy === "function") await parser.destroy();
        } catch (inner: any) {
          // Try with Buffer fallback
          if (inner.message?.includes("worker") || inner.message?.includes("Cannot find module")) {
            throw inner;
          }
          throw inner;
        }
      } else if (typeof pdfParseModule.default === "function") {
        const data = await pdfParseModule.default(buffer);
        text = data.text || "";
        numPages = data.numpages || data.numPages || data.totalPages || 1;
      } else if (typeof pdfParseModule === "function") {
        const data = await pdfParseModule(buffer);
        text = data.text || "";
        numPages = data.numpages || data.numPages || data.totalPages || 1;
      }
      if (text && text.trim().length >= 10) {
        return { text: cleanText(text), pageCount: numPages };
      }
      throw new Error("pdf-parse returned empty");
    } catch (e: any) {
      console.warn("pdf-parse fallback failed:", e.message);
    }

    // Strategy 3: pdfjs-dist direct (manual)
    try {
      // Use pdfjs-dist legacy build - dynamic import without type checking
      // @ts-ignore - dynamic import with fallback
      const pdfjs: any = await (async () => {
        try { return await import("pdfjs-dist/legacy/build/pdf.mjs"); } catch {}
        return await import("pdfjs-dist");
      })();
      if (pdfjs.getDocument) {
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuf), verbosity: 0 });
        const pdf = await loadingTask.promise;
        let fullText = "";
        for (let i=1; i<=pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const strings = (content.items as any[]).map((it:any)=> it.str || "").join(" ");
          fullText += strings + "\n\n";
        }
        if (fullText.trim().length >= 10) return { text: cleanText(fullText), pageCount: pdf.numPages };
      }
    } catch (e: any) {
      console.warn("pdfjs fallback failed:", e.message);
    }

    throw new Error("Failed to extract PDF text. The file may be scanned (image-only), encrypted, or corrupted. Try TXT or DOCX, or ensure PDF has selectable text.");
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
