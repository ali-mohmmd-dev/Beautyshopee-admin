import fs from "node:fs";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { emptyImage, schemas } from "../src/lib/model";
process.loadEnvFile(".env");
const connection = new URL(process.env.DATABASE_URL!);
connection.searchParams.set("connection_limit", "1");
const db = new PrismaClient({ datasourceUrl: connection.toString() });
const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const alt =
  "Tropical Charm Beauty Duo — 20% off selected products at Beauty Shoppee Tirur.";
async function upload(filename: string) {
  const body = fs.readFileSync(
    "../tirur-beauty-bloom-shop-main/src/assets/" + filename,
  );
  const key =
    "banners/" +
    filename.replace(".webp", "") +
    "-" +
    createHash("sha256").update(body).digest("hex").slice(0, 16) +
    ".webp";
  const url = process.env.R2_PUBLIC_URL!.replace(/\/$/, "") + "/" + key;
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: body,
      ContentType: "image/webp",
      CacheControl: "public,max-age=31536000,immutable",
    }),
  );
  const metadata = {
    url,
    filename,
    contentType: "image/webp",
    size: body.length,
    alt,
    caption: filename.includes("mobile")
      ? "Square mobile homepage banner"
      : "Wide desktop homepage banner",
    imageText:
      "Feel the Tropical Charm. Beauty Duo. 20% OFF. Selected products.",
    decorative: false,
  };
  await db.media.upsert({
    where: { key },
    create: { key, ...metadata },
    update: metadata,
  });
  return {
    ...emptyImage,
    url,
    alt,
    caption: metadata.caption,
    imageText: metadata.imageText,
  };
}
async function main() {
  const desktopImage = await upload("hero-banner.webp");
  const mobileImage = await upload("hero-banner-mobile.webp");
  await db.$transaction(
    async (tx) => {
      const home = await tx.content.findUniqueOrThrow({
        where: { kind_slug: { kind: "pages", slug: "home" } },
      });
      fs.mkdirSync(".next", { recursive: true });
      fs.writeFileSync(
        ".next/home-before-hero-images.json",
        JSON.stringify(home, null, 2),
      );
      const heroBanner = { desktopImage, mobileImage };
      const draft = { ...(home.draft as Record<string, unknown>), heroBanner };
      schemas.pages.parse(draft);
      const published = home.published
        ? { ...(home.published as Record<string, unknown>), heroBanner }
        : undefined;
      if (published) schemas.pages.parse(published);
      const updated = await tx.content.updateMany({
        where: { id: home.id, version: home.version },
        data: {
          draft,
          ...(published ? { published } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw Error("Homepage changed during installation; retry.");
      await tx.revision.create({
        data: {
          contentId: home.id,
          version: home.version + 1,
          action: "hero-images",
          data: draft,
        },
      });
    },
    { timeout: 20000, isolationLevel: "Serializable" },
  );
  let refreshed = false;
  try {
    const response = await fetch(
      new URL("/api/cms-revalidate", process.env.STOREFRONT_URL!),
      {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.CMS_CONTENT_TOKEN },
        signal: AbortSignal.timeout(10000),
      },
    );
    refreshed = response.ok;
  } catch {}
  console.log(
    JSON.stringify({
      installed: true,
      images: ["desktop", "mobile"],
      preservedOtherDraftAndPublishedContent: true,
      cacheRefreshed: refreshed,
    }),
  );
}
main()
  .catch((error) => {
    console.error(
      "Hero image installation failed",
      error.name,
      error.code ?? "",
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
