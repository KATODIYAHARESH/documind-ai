import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { documents, chunks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { extractTextFromFile, chunkText, validateFile, estimateTokens } from "@/lib/document-processing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e: any) {
      return NextResponse.json({ error: "Invalid form data. Ensure you're sending multipart/form-data with files." }, { status: 400 });
    }
    
    // Accept both "files" and "file" keys, plus any file entries
    let files: File[] = [];
    const filesMulti = formData.getAll("files") as File[];
    const fileSingle = formData.getAll("file") as File[];
    // Also collect any entry that is a File (handles cases where frontend uses different key)
    const allEntries: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File) allEntries.push(value as File);
    }
    
    if (filesMulti.length > 0 && filesMulti[0] instanceof File && filesMulti[0].size > 0) files = filesMulti;
    else if (fileSingle.length > 0 && fileSingle[0] instanceof File) files = fileSingle;
    else if (allEntries.length > 0) files = allEntries;
    else files = filesMulti as File[];

    // Filter out empty
    files = files.filter(f => f && typeof f.name === "string" && f.size !== undefined);
    
    console.log(`[upload] Received ${files.length} files:`, files.map(f=>`${f.name} (${f.size} bytes, ${f.type})`));
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files received. Please select a PDF, DOCX, or TXT file." }, { status: 400 });
    }
    
    if (files.length > 5) {
      return NextResponse.json({ error: "Maximum 5 files per upload. You sent " + files.length }, { status: 400 });
    }
    
    const results: any[] = [];
    
    for (const file of files) {
      console.log(`[upload] Processing ${file.name}, size=${file.size}, type=${file.type}`);
      const validationError = validateFile(file as any);
      if (validationError) {
        console.warn(`[upload] Validation failed for ${file.name}: ${validationError}`);
        results.push({ filename: file.name, error: validationError, status: "failed" });
        continue;
      }
      
      let documentId: string | undefined;
      try {
        const extracted = await extractTextFromFile(file as any);
        console.log(`[upload] Extracted ${extracted.text.length} chars from ${file.name}, pages=${extracted.pageCount}`);
        
        if (!extracted.text || extracted.text.trim().length < 20) {
          results.push({ filename: file.name, error: "Document appears empty or text extraction returned no content. For PDFs, ensure it contains selectable text (not scanned images).", status: "failed" });
          continue;
        }
        
        const [doc] = await db.insert(documents).values({
          filename: file.name,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          status: "processing",
          chunkCount: 0,
          pageCount: extracted.pageCount || 1,
          textLength: extracted.text.length,
          preview: extracted.text.slice(0, 500),
        }).returning();
        documentId = doc.id;
        
        console.log(`[upload] Created document record ${doc.id}`);
        
        const chunked = chunkText(extracted.text, 900, 150);
        console.log(`[upload] Chunked into ${chunked.length} chunks`);
        
        const contentChunks = chunked.length > 0
          ? chunked
          : [{ content: extracted.text.slice(0, 2000), heading: undefined }];
        const chunkInserts = contentChunks.map((c, idx) => ({
            documentId: doc.id,
          chunkIndex: idx,
          content: c.content,
          heading: c.heading,
          pageNumber: Math.floor((idx / Math.max(1, contentChunks.length)) * (extracted.pageCount || 1)) + 1,
          tokenCount: estimateTokens(c.content),
        }));
        
        for (let i = 0; i < chunkInserts.length; i += 50) {
          await db.insert(chunks).values(chunkInserts.slice(i, i + 50));
        }
        
        await db.update(documents).set({
          status: "completed",
          chunkCount: contentChunks.length,
          updatedAt: new Date(),
        }).where(eq(documents.id, doc.id));
        console.log(`[upload] Completed ${file.name} with ${contentChunks.length} chunks`);
        
        results.push({ id: doc.id, filename: file.name, originalName: file.name, mimeType: file.type, size: file.size, status: "completed", chunkCount: contentChunks.length, pageCount: extracted.pageCount, preview: extracted.text.slice(0,200), createdAt: doc.createdAt });
        
      } catch (err: any) {
        console.error(`[upload] File processing error for ${file.name}:`, err);
        if (documentId) {
          try {
            await db.delete(documents).where(eq(documents.id, documentId));
          } catch (cleanupError) {
            console.error(`[upload] Could not roll back failed document ${documentId}:`, cleanupError);
          }
        }
        let msg = err.message || "Processing failed";
        // Friendly messages
        if (msg.includes("password") || msg.includes("encrypted")) msg = "This PDF is password-protected and cannot be processed.";
        if (msg.includes("No extractable")) msg = "No extractable text found. Scanned PDFs (image-only) are not supported. Please use a PDF with selectable text or convert to TXT/DOCX.";
        results.push({ filename: file.name, error: msg, status: "failed" });
      }
    }
    
    const successCount = results.filter(r => !r.error).length;
    const hasSuccess = successCount > 0;
    console.log(`[upload] Done: ${successCount}/${files.length} succeeded`);
    
    return NextResponse.json({ 
      message: hasSuccess ? `Successfully processed ${successCount}/${files.length} file(s)` : `Failed to process ${files.length} file(s)`,
      documents: results,
      success: hasSuccess
    }, { status: hasSuccess ? 200 : (results.length === 1 ? 400 : 207) });
  } catch (e: any) {
    console.error("[upload] Fatal error:", e);
    return NextResponse.json({ error: e.message || "Upload failed. Please try again." }, { status: 500 });
  }
}
