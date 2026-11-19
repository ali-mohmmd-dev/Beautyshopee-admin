import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { equal } from "@/lib/auth";
export async function GET(request: Request) {
  const token = process.env.CMS_CONTENT_TOKEN;
  if (
    !token ||
    !equal(request.headers.get("authorization") ?? "", "Bearer " + token)
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const records = await db.content.findMany({
    where: { published: { not: Prisma.DbNull }, archivedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      slug: true,
      published: true,
      publishedAt: true,
    },
  });
  return NextResponse.json(
    { records },
    { headers: { "Cache-Control": "no-store" } },
  );
}
