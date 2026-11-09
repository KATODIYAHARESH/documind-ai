import { describe, expect, it } from "vitest";
import { retrieveChunks } from "@/lib/retrieval";
import { chunkPages, chunkText, extractTextFromFile, formatPdfLayout, layoutPdfTextItems, validateFile } from "@/lib/document-processing";

describe("document retrieval and validation", () => {
  it("retrieves the most relevant chunks for a query", () => {
    const chunks = [
      { id: "1", documentId: "doc-1", chunkIndex: 0, content: "The project uses a distributed service architecture for high availability.", pageNumber: 1, heading: "Architecture", tokenCount: 18 },
      { id: "2", documentId: "doc-1", chunkIndex: 1, content: "The team focuses on user onboarding and onboarding flows for new customers.", pageNumber: 1, heading: "Product", tokenCount: 19 },
      { id: "3", documentId: "doc-1", chunkIndex: 2, content: "Security tools monitor authentication logs and access control events.", pageNumber: 2, heading: "Security", tokenCount: 17 },
    ] as any;

    const results = retrieveChunks("distributed service architecture", chunks, 3);
    expect(results[0].heading).toBe("Architecture");
    expect(results.length).toBeGreaterThan(0);
  });

  it("rejects unsupported file types and empty files", () => {
    const unsupported = new File(["test"], "notes.exe", { type: "application/x-msdownload" });
    const empty = new File([], "empty.txt", { type: "text/plain" });

    expect(validateFile(unsupported)).toContain("Unsupported file type");
    expect(validateFile(empty)).toBe("File is empty (0 bytes)");
  });

  it("keeps oversized paragraphs within the requested chunk size", () => {
    const text = `OVERVIEW\n\n${"This paragraph contains enough repeated words to create several chunks. ".repeat(40)}`;
    const chunks = chunkText(text, 120, 24);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.content.length <= 120)).toBe(true);
    expect(chunks.every((chunk) => chunk.heading === "OVERVIEW")).toBe(true);
  });

  it("does not discard ordinary sentence-case text without terminal punctuation", () => {
    const text = "This paragraph has no ending punctuation and must remain part of the document";
    expect(chunkText(text).map((chunk) => chunk.content).join(" ")).toContain("This paragraph");
  });

  it("rejects invalid chunk and overlap sizes", () => {
    expect(() => chunkText("Some content that is long enough to make a chunk.", 10, 10)).toThrow(RangeError);
  });

  it("preserves PDF columns, heading structure, and actual page numbers", () => {
    const layout = layoutPdfTextItems([
      { str: "Payment Terms", transform: [0, 0, 0, 20, 50, 700], width: 120, height: 20 },
      { str: "Party", transform: [0, 0, 0, 10, 50, 680], width: 30, height: 10 },
      { str: "Payment deadline", transform: [0, 0, 0, 10, 160, 680], width: 80, height: 10 },
      { str: "Buyer", transform: [0, 0, 0, 10, 50, 660], width: 35, height: 10 },
      { str: "30 days after invoice", transform: [0, 0, 0, 10, 160, 660], width: 100, height: 10 },
    ]);
    const chunks = chunkPages([{ pageNumber: 4, text: formatPdfLayout(layout) }]);

    expect(layout[0].text).toBe("# Payment Terms");
    expect(layout[2].text).toContain(" | ");
    expect(chunks[0]).toMatchObject({ pageNumber: 4, heading: "Payment Terms" });
    expect(chunks[0].content).toContain("30 days after invoice");
  });

  it("marks OCR-derived passages so citations can disclose their extraction method", () => {
    const [chunk] = chunkPages([{ pageNumber: 2, text: "A scanned passage with enough words to remain available for citations.", ocr: true }]);
    expect(chunk).toMatchObject({ pageNumber: 2, heading: "OCR extracted" });
  });

  it("extracts selectable PDF text with real page metadata", async () => {
    const stream = "BT /F1 14 Tf 50 750 Td (Invoice payment is due in thirty days.) Tj ET";
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    for (const [index, object] of objects.entries()) {
      offsets.push(Buffer.byteLength(pdf, "ascii"));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    }
    const xrefOffset = Buffer.byteLength(pdf, "ascii");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const bytes = Buffer.from(pdf, "ascii");
    const result = await extractTextFromFile({
      name: "invoice.pdf",
      type: "application/pdf",
      arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    });

    expect(result.pageCount).toBe(1);
    expect(result.pages).toEqual([expect.objectContaining({ pageNumber: 1 })]);
    expect(result.text).toContain("Invoice payment is due in thirty days.");
  });
});
