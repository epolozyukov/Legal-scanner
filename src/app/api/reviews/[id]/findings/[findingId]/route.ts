import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { findings as findingsTable } from "@/lib/db/schema";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/reviews/[id]/findings/[findingId]">,
) {
  const { findingId } = await ctx.params;
  const { status } = (await request.json()) as { status?: string };

  if (status !== "approved" && status !== "dismissed") {
    return NextResponse.json({ error: "status must be 'approved' or 'dismissed'" }, { status: 400 });
  }

  const [updated] = await db
    .update(findingsTable)
    .set({ status, decidedAt: new Date() })
    .where(eq(findingsTable.id, findingId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
