import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { checkOrigin, requireAdmin } from "@/lib/auth";
import { kinds, type Kind } from "@/lib/model";
import { Conflict, saveContent } from "@/lib/content";
import { refreshStorefront } from "@/lib/storefront-cache";
export async function POST(request: Request) {
  try {
    await requireAdmin();
    await checkOrigin();
    if (Number(request.headers.get("content-length") ?? 0) > 2_000_000)
      return NextResponse.json(
        { error: "Content is too large" },
        { status: 413 },
      );
    const body = await request.json();
    if (
      !kinds.includes(body.kind) ||
      !["save", "publish", "unpublish"].includes(body.action) ||
      !Number.isInteger(body.version)
    )
      return NextResponse.json({ error: "Invalid operation" }, { status: 400 });
    const record = await saveContent(
      body.kind as Kind,
      body.id || null,
      body.data,
      body.version,
      body.action,
    );
    const refreshed = body.action === "save" || (await refreshStorefront());
    return NextResponse.json({
      warning: refreshed
        ? undefined
        : `Content was saved, but the website cache could not be refreshed. Retry ${body.action === "unpublish" ? "Unpublish" : "Publish"}, or check the storefront connection settings.`,
      id: record.id,
      version: record.version,
      publishedAt: record.publishedAt,
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        {
          error: error.issues
            .map((issue) => issue.path.join(".") + ": " + issue.message)
            .join("\n"),
        },
        { status: 400 },
      );
    if (error instanceof Conflict)
      return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return NextResponse.json(
          { error: "This slug is already in use" },
          { status: 409 },
        );
      if (error.code === "P2034")
        return NextResponse.json(
          {
            error:
              "Another update happened at the same time. Reload and try again.",
          },
          { status: 409 },
        );
      console.error("CMS save failed", error.code);
      return NextResponse.json(
        { error: "Unable to save content. Try again." },
        { status: 500 },
      );
    }
    const message = error instanceof Error ? error.message : "Unable to save";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 },
    );
  }
}
