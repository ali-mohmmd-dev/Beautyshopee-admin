import { randomUUID } from "node:crypto";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { r2 } from "@/lib/r2";
import { checkOrigin, requireAdmin } from "@/lib/auth";
export const runtime = "nodejs";
function detect(b: Buffer) {
  if (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return ["image/png", "png"];
  if (b[0] === 255 && b[1] === 216 && b[2] === 255)
    return ["image/jpeg", "jpg"];
  if (
    b.subarray(0, 4).toString() === "RIFF" &&
    b.subarray(8, 12).toString() === "WEBP"
  )
    return ["image/webp", "webp"];
  return null;
}
export async function POST(request: Request) {
  try {
    await requireAdmin();
    await checkOrigin();
    if (Number(request.headers.get("content-length") ?? 0) > 11_000_000)
      return NextResponse.json(
        { error: "Maximum upload size is 10 MB" },
        { status: 413 },
      );
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0 || file.size > 10_000_000)
      return NextResponse.json(
        { error: "Choose a PNG, JPEG, or WebP up to 10 MB" },
        { status: 400 },
      );
    const body = Buffer.from(await file.arrayBuffer());
    const type = detect(body);
    if (!type)
      return NextResponse.json(
        { error: "Only PNG, JPEG, and WebP images are accepted" },
        { status: 400 },
      );
    const key = "media/" + randomUUID() + "." + type[1];
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: type[0],
        CacheControl: "public,max-age=31536000,immutable",
      }),
    );
    try {
      const media = await db.media.create({
        data: {
          key,
          url: process.env.R2_PUBLIC_URL!.replace(/\/$/, "") + "/" + key,
          filename: file.name.slice(0, 255),
          contentType: type[0],
          size: file.size,
        },
      });
      return NextResponse.json(media);
    } catch (error) {
      await r2
        .send(
          new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
          }),
        )
        .catch(() => console.error("R2 cleanup failed", key));
      throw error;
    }
  } catch (error) {
    console.error(
      "Media upload failed",
      error instanceof Error ? error.name : "Unknown",
    );
    return NextResponse.json(
      { error: "Image upload failed. Check R2 configuration and try again." },
      { status: 500 },
    );
  }
}
export async function PATCH(request: Request) {
  try {
    await requireAdmin();
    await checkOrigin();
    const { id, alt, caption, imageText, decorative } = await request.json();
    if (
      typeof id !== "string" ||
      [alt, caption, imageText].some(
        (v) => typeof v !== "string" || v.length > 30000,
      ) ||
      typeof decorative !== "boolean"
    )
      return NextResponse.json(
        { error: "Invalid media details" },
        { status: 400 },
      );
    const media = await db.media.update({
      where: { id },
      data: { alt, caption, imageText, decorative },
    });
    return NextResponse.json(media);
  } catch {
    return NextResponse.json(
      { error: "Unable to update media" },
      { status: 400 },
    );
  }
}
