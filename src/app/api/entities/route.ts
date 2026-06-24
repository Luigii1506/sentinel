import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get("limit");
  const limit = Math.min(Number(limitParam ?? 20) || 20, 100);

  const entities = await db.entity.findMany({
    orderBy: { lastSeenAt: "desc" },
    take: limit,
    include: {
      _count: {
        select: { changes: true },
      },
    },
  });

  return NextResponse.json({ entities });
}
