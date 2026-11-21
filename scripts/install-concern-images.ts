import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { schemas } from "../src/lib/model";
process.loadEnvFile(".env");
const connection = new URL(process.env.DATABASE_URL!);
connection.searchParams.set("connection_limit", "1");
const db = new PrismaClient({ datasourceUrl: connection.toString() });
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const images = [
  {
    slug: "sample-lip-care",
    file: "lip-care",
    alt: "Close-up of glossy lips for lip care",
    caption: "Lip care",
  },
  {
    slug: "sample-fresh-glow",
    file: "fresh-glow",
    alt: "Soft rosy blush and luminous cheek makeup for a fresh glow",
    caption: "Fresh glow",
  },
  {
    slug: "sample-eye-definition",
    file: "eye-definition",
    alt: "Close-up of defined eyeliner and mascara lashes",
    caption: "Eye definition",
  },
  {
    slug: "sample-everyday-makeup",
    file: "everyday-makeup",
    alt: "Natural everyday makeup with subtle lip color and mascara",
    caption: "Everyday makeup",
  },
  {
    slug: "sample-complete-routine",
    file: "complete-routine",
    alt: "Complete makeup kit with foundation, blush, lipstick, mascara and brushes",
    caption: "Complete routine",
  },
];
async function main() {
  const records = await db.content.findMany({
    where: {
      kind: "concerns",
      slug: { in: images.map((image) => image.slug) },
      archivedAt: null,
    },
  });
  assert.equal(
    records.length,
    images.length,
    "All concern records must exist before replacing images",
  );
  fs.mkdirSync(".next", { recursive: true });
  fs.writeFileSync(
    ".next/concerns-before-images.json",
    JSON.stringify(records, null, 2),
  );
  const uploaded: {
    slug: string;
    caption: string;
    placement: {
      url: string;
      alt: string;
      caption: string;
      imageText: string;
      decorative: boolean;
    };
  }[] = [];
  for (const image of images) {
    const body = fs.readFileSync(
      "../tirur-beauty-bloom-shop-main/src/assets/concerns/" +
        image.file +
        ".webp",
    );
    const key =
      "concerns/" +
      image.file +
      "-" +
      createHash("sha256").update(body).digest("hex").slice(0, 16) +
      ".webp";
    const url = process.env.R2_PUBLIC_URL!.replace(/\/$/, "") + "/" + key;
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: key,
        Body: body,
        ContentType: "image/webp",
        CacheControl: "public,max-age=31536000,immutable",
      }),
    );
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(
      response.status,
      200,
      "Uploaded image must be publicly accessible",
    );
    const metadata = {
      url,
      filename: "concern-" + image.file + ".webp",
      contentType: "image/webp",
      size: body.length,
      alt: image.alt,
      caption: image.caption,
      imageText: "",
      decorative: false,
    };
    await db.media.upsert({
      where: { key },
      create: { key, ...metadata },
      update: metadata,
    });
    uploaded.push({
      ...image,
      placement: {
        url,
        alt: image.alt,
        caption: image.caption,
        imageText: "",
        decorative: false,
      },
    });
  }
  await db.$transaction(
    async (tx) => {
      for (const image of uploaded) {
        const record = await tx.content.findUniqueOrThrow({
          where: { kind_slug: { kind: "concerns", slug: image.slug } },
        });
        const before = records.find((item) => item.id === record.id)!;
        assert.equal(
          record.version,
          before.version,
          "Concern changed during image installation; retry",
        );
        const draft = {
          ...(record.draft as Record<string, unknown>),
          image: image.placement,
        };
        const published = record.published
          ? {
              ...(record.published as Record<string, unknown>),
              image: image.placement,
            }
          : undefined;
        schemas.concerns.parse(draft);
        if (published) schemas.concerns.parse(published);
        const result = await tx.content.updateMany({
          where: { id: record.id, version: record.version },
          data: {
            draft,
            ...(published ? { published } : {}),
            version: { increment: 1 },
          },
        });
        assert.equal(result.count, 1);
        await tx.revision.create({
          data: {
            contentId: record.id,
            version: record.version + 1,
            action: "concern-image",
            data: draft,
          },
        });
      }
    },
    { timeout: 30000, isolationLevel: "Serializable" },
  );
  let cacheRefreshed = false;
  for (let attempt = 0; attempt < 2 && !cacheRefreshed; attempt++) {
    try {
      const response = await fetch(
        new URL("/api/cms-revalidate", process.env.STOREFRONT_URL!),
        {
          method: "POST",
          headers: { Authorization: "Bearer " + process.env.CMS_CONTENT_TOKEN },
          signal: AbortSignal.timeout(10000),
        },
      );
      cacheRefreshed = response.ok;
    } catch {}
  }
  console.log(
    JSON.stringify({
      updated: uploaded.map((image) => image.caption),
      cacheRefreshed,
      publicImagesVerified: true,
      preservedOtherDraftAndPublishedContent: true,
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      "Concern image installation failed",
      error.name,
      error.code ?? "",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
