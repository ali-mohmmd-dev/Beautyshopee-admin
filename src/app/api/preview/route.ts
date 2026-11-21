import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
export async function GET(request: Request) {
  await requireAdmin();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return new NextResponse("Missing record", { status: 400 });
  const record = await db.content.findUnique({ where: { id } });
  if (!record) return new NextResponse("Record not found", { status: 404 });
  const path =
    record.kind === "pages"
      ? String((record.draft as Record<string, unknown>).path)
      : record.kind === "concerns"
        ? "/concerns/" + record.slug
        : record.kind === "products"
          ? "/products/" + record.slug
          : "/";
  const url = new URL("/api/cms-preview", process.env.STOREFRONT_URL);
  url.searchParams.set("token", process.env.CMS_CONTENT_TOKEN!);
  url.searchParams.set("path", path);
  return NextResponse.redirect(url);
}
