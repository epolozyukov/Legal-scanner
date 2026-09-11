import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db/client";
import { findings as findingsTable, reviews as reviewsTable } from "@/lib/db/schema";
import { detectFileKind, extractText, UnextractableTextError } from "@/lib/extraction";
import { classifyDocument, analyzeContract } from "@/lib/ai/analyze";
import { getRuleset } from "@/lib/rulesets/loader";
import { locateQuote } from "@/lib/highlighting/locate-quote";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 10MB limit" }, { status: 400 });
  }

  const kind = detectFileKind(file.name, file.type);
  if (!kind) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, DOCX, or plain text file." },
      { status: 400 },
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let extractedText: string;
  try {
    extractedText = await extractText(buffer, kind);
  } catch (err) {
    if (err instanceof UnextractableTextError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    throw err;
  }

  const classification = await classifyDocument(extractedText);

  const ruleset = await getRuleset(classification.documentType);
  if (!ruleset) {
    const message =
      classification.documentType === "other"
        ? "This doesn't look like a contract Legal Scanner can review. Right now it only analyzes Statements of Work (SOW) — support for NDAs and MSAs is coming soon."
        : `This looks like an ${classification.documentType}, but Legal Scanner currently only analyzes Statements of Work (SOW). Support for ${classification.documentType} is coming soon.`;
    return NextResponse.json(
      {
        error: message,
        documentType: classification.documentType,
      },
      { status: 422 },
    );
  }

  const analysis = await analyzeContract(extractedText, ruleset);

  const blob = await put(`contracts/${Date.now()}-${file.name}`, buffer, {
    access: "public",
    contentType: file.type || "application/octet-stream",
  });

  const [review] = await db
    .insert(reviewsTable)
    .values({
      fileName: file.name,
      blobUrl: blob.url,
      documentType: classification.documentType,
      rulesetVersion: ruleset.version,
      extractedText,
    })
    .returning();

  const rows = analysis.findings.map((finding) => {
    const location = locateQuote(extractedText, finding.quote);
    return {
      reviewId: review.id,
      ruleId: finding.ruleId,
      category: finding.category,
      severity: finding.severity,
      quote: finding.quote,
      quoteStart: location?.start ?? null,
      quoteEnd: location?.end ?? null,
      issue: finding.issue,
      suggestedFix: finding.suggestedFix,
    };
  });

  if (rows.length > 0) {
    await db.insert(findingsTable).values(rows);
  }

  return NextResponse.json({ reviewId: review.id }, { status: 201 });
}
