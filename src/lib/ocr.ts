import Tesseract from "tesseract.js";

export async function extractTextFromImage(file: Blob | File | ArrayBuffer | Buffer): Promise<string> {
  try {
    let image: Blob | Buffer;
    if (file instanceof ArrayBuffer) {
      image = Buffer.from(file);
    } else if (Buffer.isBuffer(file)) {
      image = file;
    } else {
      image = file;
    }

    const result = await Tesseract.recognize(image as any, "eng", {
      logger: () => undefined,
    });
    return (result?.data?.text || "").trim();
  } catch (error) {
    console.warn("OCR failed:", error);
    throw new Error("OCR failed for this scanned image. Please upload a text-based PDF, DOCX, or TXT file.");
  }
}
