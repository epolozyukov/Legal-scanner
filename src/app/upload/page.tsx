"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) {
      setError("Choose a file first");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.set("file", file);

    const res = await fetch("/api/analyze", { method: "POST", body: formData });
    const data = await res.json();

    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Analysis failed");
      return;
    }

    router.push(`/reviews/${data.reviewId}`);
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Upload a contract</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="file" name="file" accept=".pdf,.docx,.txt" className="rounded border border-gray-300 p-2" />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? "Analyzing..." : "Analyze"}
        </button>
      </form>
    </main>
  );
}
