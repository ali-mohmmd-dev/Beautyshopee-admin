import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  emptyRecord,
  emptyImage,
  emptySeo,
  emptyVariant,
} from "../src/lib/model";
process.loadEnvFile(".env");
const db = new PrismaClient();
const origin = process.env.TEST_CMS_URL ?? "http://localhost:3101";
const store = process.env.TEST_STOREFRONT_URL ?? "http://localhost:3100";
const ids: string[] = [];
let mediaId = "",
  mediaKey = "";
async function main() {
  const landing = await fetch(origin, { redirect: "manual" });
  assert.equal(landing.status, 307);
  assert.match(landing.headers.get("location") ?? "", /login/);
  const denied = await fetch(origin + "/api/content", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: "{}",
  });
  assert.equal(denied.status, 401);
  const password = fs
    .readFileSync(".local-admin.txt", "utf8")
    .match(/Password: (.+)/)?.[1];
  assert.ok(password);
  const login = await fetch(origin + "/api/login", {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams({ password }),
    redirect: "manual",
  });
  assert.equal(login.status, 303);
  assert.equal(login.headers.get("location"), origin + "/");
  const cookie = login.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("cms-session="));
  const request = async (body: unknown) => {
    const response = await fetch(origin + "/api/content", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, data: await response.json() };
  };
  const before = await db.content.findFirstOrThrow({
    where: { kind: "pages", slug: "home" },
  });
  const original = before.draft;
  try {
    const draft = { ...(before.draft as Record<string, any>) };
    draft.blocks = draft.blocks.map((block: any, index: number) =>
      index === 0 ? { ...block, text: "CMS draft preview smoke check" } : block,
    );
    const saved = await request({
      kind: "pages",
      id: before.id,
      version: before.version,
      data: draft,
      action: "save",
    });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const published = await fetch(store).then((r) => r.text());
    assert.ok(!published.includes("CMS draft preview smoke check"));
    const conflict = await request({
      kind: "pages",
      id: before.id,
      version: before.version,
      data: draft,
      action: "save",
    });
    assert.equal(conflict.status, 409);
    const live = await request({
      kind: "pages",
      id: before.id,
      version: saved.data.version,
      data: draft,
      action: "publish",
    });
    assert.equal(live.status, 200, JSON.stringify(live.data));
    assert.ok(
      (await fetch(store).then((r) => r.text())).includes(
        "CMS draft preview smoke check",
      ),
    );
    const restored = await request({
      kind: "pages",
      id: before.id,
      version: live.data.version,
      data: original,
      action: "publish",
    });
    assert.equal(restored.status, 200);
    console.log(
      "Draft isolation, published text updates, revision conflict protection, and content restoration passed.",
    );
  } finally {
    const latest = await db.content.findUniqueOrThrow({
      where: { id: before.id },
    });
    if (JSON.stringify(latest.draft) !== JSON.stringify(original))
      await request({
        kind: "pages",
        id: before.id,
        version: latest.version,
        data: original,
        action: "publish",
      });
  }
  const category = await db.content.findFirstOrThrow({
    where: { kind: "categories", slug: "face" },
  });
  const brand = await db.content.findFirstOrThrow({
    where: { kind: "brands" },
  });
  const key = "cms-smoke-" + Date.now();
  const product = {
    ...emptyRecord("products"),
    name: "CMS smoke test",
    slug: key,
    brandId: brand.id,
    categoryIds: [category.id],
    shortDescription: "A temporary test product.",
    description: "## Details\n\nA temporary content editing test.",
    images: [
      {
        ...emptyImage,
        url:
          process.env.R2_PUBLIC_URL + "/imported/src/assets/product-blush.jpg",
        alt: "Blush",
      },
    ],
    variants: [
      {
        ...emptyVariant,
        sku: key + "-5",
        options: [{ name: "Shade", value: "Rose" }],
        netQuantity: 5,
        unit: "g",
        price: 500,
        stock: 10,
      },
      {
        ...emptyVariant,
        sku: key + "-10",
        options: [{ name: "Shade", value: "Peach" }],
        netQuantity: 10,
        unit: "g",
        price: 700,
        stock: 5,
      },
    ],
    seo: {
      ...emptySeo,
      title: "CMS smoke test",
      description: "Temporary test product for verifying CMS publishing.",
    },
  };
  const created = await request({
    kind: "products",
    id: null,
    version: 0,
    data: product,
    action: "publish",
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  ids.push(created.data.id);
  const productHtml = await fetch(store + "/products/" + key);
  assert.equal(productHtml.status, 200);
  const html = await productHtml.text();
  assert.match(html, /CMS smoke test/);
  assert.match(html, /Peach/);
  assert.match(html, /10 g/);
  console.log(
    "New product publishing, brand/category relations, and variant choices passed.",
  );
  const file = new FormData();
  file.set(
    "file",
    new File(
      [
        fs.readFileSync(
          "../tirur-beauty-bloom-shop-main/public/beauty-shoppee-logo.png",
        ),
      ],
      "cms-smoke.png",
      { type: "image/png" },
    ),
  );
  const upload = await fetch(origin + "/api/media", {
    method: "POST",
    headers: { Cookie: cookie, Origin: origin },
    body: file,
  });
  assert.equal(upload.status, 200);
  const image = await upload.json();
  mediaId = image.id;
  mediaKey = image.key;
  assert.equal((await fetch(image.url)).status, 200);
  const details = await fetch(origin + "/api/media", {
    method: "PATCH",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: mediaId,
      alt: "Store logo",
      caption: "Smoke test",
      imageText: "Beauty Shoppee",
      decorative: false,
    }),
  });
  assert.equal(details.status, 200);
  const forbidden = await fetch(origin + "/api/content", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: "https://example.invalid",
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(forbidden.status, 400);
  console.log(
    "R2 upload, public image delivery, media metadata editing, authentication, and request origin checks passed.",
  );
}
main().finally(async () => {
  if (ids.length) {
    await db.revision.deleteMany({ where: { contentId: { in: ids } } });
    await db.content.deleteMany({ where: { id: { in: ids } } });
  }
  if (mediaKey) {
    const r2 = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    await r2.send(
      new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: mediaKey,
      }),
    );
    if (mediaId) await db.media.delete({ where: { id: mediaId } });
  }
  await db.$disconnect();
});
