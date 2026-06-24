import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Number(limitParam ?? 20) || 20, 100);

  const changes = await db.changeLog.findMany({
    orderBy: { detectedAt: "desc" },
    take: limit,
    include: {
      entity: {
        select: {
          id: true,
          canonicalId: true,
          canonicalName: true,
        },
      },
      observation: {
        select: {
          id: true,
          sourceUrl: true,
          fetchedAt: true,
        },
      },
    },
  });

  return NextResponse.json({ changes });
}
