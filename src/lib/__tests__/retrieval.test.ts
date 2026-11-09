import { describe, expect, it } from "vitest";
import { retrieveChunks } from "@/lib/retrieval";
import { chunkText, validateFile } from "@/lib/document-processing";

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
});
