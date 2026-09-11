export class UnextractableTextError extends Error {
  constructor(message = "No extractable text found in the uploaded file") {
    super(message);
    this.name = "UnextractableTextError";
  }
}

export type SupportedFileKind = "pdf" | "docx" | "text";

export function detectFileKind(fileName: string, mimeType: string): SupportedFileKind | null {
  if (mimeType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf")) return "pdf";
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    fileName.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }
  if (mimeType.startsWith("text/") || fileName.toLowerCase().endsWith(".txt")) return "text";
  return null;
}

export async function extractText(buffer: Buffer, kind: SupportedFileKind): Promise<string> {
  const text = await extractRaw(buffer, kind);
  if (!text || text.trim().length === 0) {
    throw new UnextractableTextError();
  }
  return text;
}

async function extractRaw(buffer: Buffer, kind: SupportedFileKind): Promise<string> {
  switch (kind) {
    case "pdf": {
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: buffer });
      try {
        const result = await parser.getText();
        return result.text;
      } finally {
        await parser.destroy();
      }
    }
    case "docx": {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    }
    case "text":
      return buffer.toString("utf-8");
  }
}
