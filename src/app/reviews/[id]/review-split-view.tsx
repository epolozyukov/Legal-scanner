"use client";

import { useState } from "react";

type Finding = {
  id: string;
  ruleId: string;
  category: string;
  severity: "green" | "amber" | "red" | "critical";
  quote: string;
  quoteStart: number | null;
  quoteEnd: number | null;
  issue: string;
  suggestedFix: string;
  status: "pending" | "approved" | "dismissed";
};

type Review = {
  id: string;
  fileName: string;
  documentType: string;
  extractedText: string;
  findings: Finding[];
};

const SEVERITY_COLORS: Record<Finding["severity"], string> = {
  green: "bg-green-100 border-green-400",
  amber: "bg-amber-100 border-amber-400",
  red: "bg-red-100 border-red-400",
  critical: "bg-red-300 border-red-700",
};

export function ReviewSplitView({ review }: { review: Review }) {
  const [findings, setFindings] = useState(review.findings);

  async function decide(findingId: string, status: "approved" | "dismissed") {
    const res = await fetch(`/api/reviews/${review.id}/findings/${findingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) return;
    setFindings((prev) => prev.map((f) => (f.id === findingId ? { ...f, status } : f)));
  }

  const segments = buildHighlightSegments(review.extractedText, findings);

  return (
    <main className="flex h-screen">
      <section className="w-1/2 overflow-y-auto border-r border-gray-200 p-6 whitespace-pre-wrap text-sm">
        <h1 className="mb-4 text-lg font-semibold">{review.fileName}</h1>
        {segments.map((segment, i) =>
          segment.finding ? (
            <mark key={i} className={`${SEVERITY_COLORS[segment.finding.severity]} border-b-2`}>
              {segment.text}
            </mark>
          ) : (
            <span key={i}>{segment.text}</span>
          ),
        )}
      </section>
      <section className="w-1/2 overflow-y-auto p-6">
        <h2 className="mb-4 text-lg font-semibold">Issues ({findings.length})</h2>
        <div className="flex flex-col gap-3">
          {findings.map((finding) => (
            <article
              key={finding.id}
              className={`rounded border-l-4 p-3 ${SEVERITY_COLORS[finding.severity]} ${
                finding.status !== "pending" ? "opacity-50" : ""
              }`}
            >
              <div className="flex items-center justify-between text-xs font-semibold uppercase">
                <span>{finding.severity}</span>
                <span>{finding.category}</span>
              </div>
              <p className="mt-2 text-sm">{finding.issue}</p>
              <p className="mt-2 text-sm italic">Suggested fix: {finding.suggestedFix}</p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => decide(finding.id, "approved")}
                  disabled={finding.status !== "pending"}
                  className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  onClick={() => decide(finding.id, "dismissed")}
                  disabled={finding.status !== "pending"}
                  className="rounded border border-black px-2 py-1 text-xs disabled:opacity-40"
                >
                  Dismiss
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

type Segment = { text: string; finding: Finding | null };

function buildHighlightSegments(sourceText: string, findings: Finding[]): Segment[] {
  const located = findings
    .filter((f) => f.quoteStart !== null && f.quoteEnd !== null)
    .sort((a, b) => (a.quoteStart ?? 0) - (b.quoteStart ?? 0));

  const segments: Segment[] = [];
  let cursor = 0;

  for (const finding of located) {
    const start = finding.quoteStart as number;
    const end = finding.quoteEnd as number;
    if (start < cursor) continue; // overlapping finding, skip highlight to avoid corrupting ranges
    if (start > cursor) segments.push({ text: sourceText.slice(cursor, start), finding: null });
    segments.push({ text: sourceText.slice(start, end), finding });
    cursor = end;
  }

  if (cursor < sourceText.length) {
    segments.push({ text: sourceText.slice(cursor), finding: null });
  }

  return segments;
}
