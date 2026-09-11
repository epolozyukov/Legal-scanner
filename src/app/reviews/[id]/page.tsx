import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/lib/db/client";
import { reviews as reviewsTable } from "@/lib/db/schema";
import { ReviewSplitView } from "./review-split-view";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const review = await db.query.reviews.findFirst({
    where: eq(reviewsTable.id, id),
    with: { findings: true },
  });

  if (!review) notFound();

  return <ReviewSplitView review={review} />;
}
