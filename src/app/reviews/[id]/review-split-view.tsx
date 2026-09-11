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
  title: string;
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

const HIGHLIGHT_COLORS: Record<Finding["severity"], string> = {
  green: "bg-green-100 text-green-900",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-900",
  critical: "bg-red-200 text-red-950",
};

const BADGE_COLORS: Record<Finding["severity"], string> = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-700",
  critical: "bg-red-200 text-red-900",
};

const CARD_BORDER_COLORS: Record<Finding["severity"], string> = {
  green: "border-l-green-400",
  amber: "border-l-amber-400",
  red: "border-l-red-400",
  critical: "border-l-red-700",
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

  function exportReport() {
    const report = {
      fileName: review.fileName,
      documentType: review.documentType,
      exportedAt: new Date().toISOString(),
      findings: findings.map(({ id, ruleId, category, severity, title, issue, suggestedFix, status }) => ({
        id,
        ruleId,
        category,
        severity,
        title,
        issue,
        suggestedFix,
        status,
      })),
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${review.fileName.replace(/\.[^.]+$/, "")}-report.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const segments = buildHighlightSegments(review.extractedText, findings);
  const openCount = findings.filter((f) => f.status === "pending").length;
  const passedCount = findings.filter((f) => f.severity === "green").length;

  return (
    <main className="mx-auto flex h-screen max-w-6xl flex-col bg-stone-50">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <DocumentIcon />
          <h1 className="text-base font-semibold text-stone-900">{review.fileName}</h1>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100">
            <GearIcon />
            Rules
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-1.5 rounded-md border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
          >
            <DownloadIcon />
            Export
          </button>
        </div>
      </header>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <section className="flex-1 overflow-y-auto rounded-xl border border-stone-200 bg-white p-6 text-sm leading-relaxed whitespace-pre-wrap text-stone-800">
          {segments.map((segment, i) =>
            segment.finding ? (
              <mark
                key={i}
                className={`rounded px-0.5 ${HIGHLIGHT_COLORS[segment.finding.severity]} ${
                  segment.finding.status !== "pending" ? "opacity-50" : ""
                }`}
              >
                {segment.text}
              </mark>
            ) : (
              <span key={i}>{segment.text}</span>
            ),
          )}
        </section>

        <section className="flex w-96 flex-col overflow-y-auto rounded-xl border border-stone-200 bg-white p-4">
          <div className="flex flex-1 flex-col gap-3">
            {findings.map((finding) => (
              <article
                key={finding.id}
                className={`rounded-lg border border-stone-200 border-l-4 bg-white p-4 shadow-sm ${
                  CARD_BORDER_COLORS[finding.severity]
                } ${finding.status !== "pending" ? "opacity-50" : ""}`}
              >
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${BADGE_COLORS[finding.severity]}`}
                >
                  {finding.severity}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-stone-900">{finding.title}</h3>
                <p className="mt-1 text-sm text-stone-600">
                  {finding.issue} {finding.suggestedFix}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => decide(finding.id, "approved")}
                    disabled={finding.status !== "pending"}
                    className="flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    <CheckIcon /> Approve
                  </button>
                  <button
                    onClick={() => decide(finding.id, "dismissed")}
                    disabled={finding.status !== "pending"}
                    className="flex items-center gap-1 rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-40"
                  >
                    <XIcon /> Dismiss
                  </button>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-4 border-t border-stone-200 pt-3 text-center text-xs text-stone-500">
            {openCount} open issue{openCount === 1 ? "" : "s"} · {passedCount} clause{passedCount === 1 ? "" : "s"} passed
          </p>
        </section>
      </div>
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

function DocumentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M18 6 6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}
