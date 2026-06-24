import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type Params = {
  params: {
    id: string;
  };
};

export async function GET(_: Request, { params }: Params) {
  const entity = await db.entity.findUnique({
    where: { id: params.id },
  });

  if (!entity) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const changes = await db.changeLog.findMany({
    where: { entityId: params.id },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ entity, changes });
}
