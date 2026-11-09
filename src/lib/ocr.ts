import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorker } from "tesseract.js";

export async function extractTextFromImages(images: Array<Blob | File | ArrayBuffer | Buffer>): Promise<string[]> {
  if (images.length === 0) return [];
  const cachePath = join(tmpdir(), "documind-tesseract");
  await mkdir(cachePath, { recursive: true });
  const worker = await createWorker("eng", 1, { cachePath, logger: () => undefined });
  try {
    const results: string[] = [];
    for (const image of images) {
      const input = image instanceof ArrayBuffer ? Buffer.from(image) : image;
      const result = await worker.recognize(input);
      results.push(result.data.text.trim());
    }
    return results;
  } catch (error) {
    console.warn("OCR failed:", error);
    throw new Error("OCR could not read one or more scanned pages. Check that the image is clear and try again.");
  } finally {
    await worker.terminate();
  }
}

export async function extractTextFromImage(image: Blob | File | ArrayBuffer | Buffer): Promise<string> {
  const [text] = await extractTextFromImages([image]);
  return text;
}
