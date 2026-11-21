import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { emptyRecord, emptySeo, emptyVariant, schemas } from "../src/lib/model";
process.loadEnvFile(".env");
const origin = process.env.TEST_CMS_URL ?? "http://localhost:3101";
const store = process.env.TEST_STOREFRONT_URL ?? "http://localhost:3100";
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set("connection_limit", "1");
const db = new PrismaClient({ datasourceUrl: url.toString() });
const created: {
  id: string;
  version: number;
  kind: string;
  data: Record<string, any>;
}[] = [];
const marker = "concern-check-" + Date.now();
let cookie = "";
async function request(
  kind: string,
  id: string | null,
  version: number,
  data: Record<string, any>,
  action: string,
) {
  const r = await fetch(origin + "/api/content", {
    method: "POST",
    headers: {
      Cookie: cookie,
      Origin: origin,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ kind, id, version, data, action }),
  });
  return { status: r.status, data: await r.json() };
}
async function save(
  kind: string,
  data: Record<string, any>,
  action: string,
  record?: (typeof created)[number],
) {
  const result = await request(
    kind,
    record?.id ?? null,
    record?.version ?? 0,
    data,
    action,
  );
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.ok(!result.data.warning, result.data.warning);
  const next = { id: result.data.id, version: result.data.version, kind, data };
  if (record) Object.assign(record, next);
  else created.push(next);
  return record ?? next;
}
async function get(path: string, preview = "") {
  const r = await fetch(store + path, {
    headers: {
      "User-Agent": "Googlebot",
      ...(preview ? { Cookie: preview } : {}),
    },
  });
  return { status: r.status, body: await r.text() };
}
try {
  const password = fs
    .readFileSync(".local-admin.txt", "utf8")
    .match(/Password: (.+)/)![1];
  const login = await fetch(origin + "/api/login", {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams({ password }),
    redirect: "manual",
  });
  cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("cms-session="));
  const media = await db.media.findFirstOrThrow();
  const image = {
    url: media.url,
    alt: "Concern verification image",
    caption: "",
    imageText: "",
    decorative: false,
  };
  const concerns = [];
  for (let index = 0; index < 5; index++) {
    const data = {
      ...emptyRecord("concerns"),
      name: marker + "-" + index,
      slug: marker + "-" + index,
      description: "Temporary concern verification",
      image,
      seo: {
        ...emptySeo,
        title: "Concern verification " + index,
        description: "Temporary SEO verification",
        noIndex: index === 4,
      },
    };
    concerns.push(await save("concerns", data, "save"));
  }
  const first = concerns[0]!;
  const path = "/concerns/" + first.data.slug;
  assert.equal((await get(path)).status, 404, "Draft concern must be private");
  const preview = await fetch(origin + "/api/preview?id=" + first.id, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  const target = new URL(preview.headers.get("location")!);
  assert.equal(target.searchParams.get("path"), path);
  const enter = await fetch(target, { redirect: "manual" });
  const previewCookie = enter.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(previewCookie);
  assert.equal(
    (await get(path, previewCookie)).status,
    200,
    "Draft concern preview must load",
  );
  const productData = {
    ...emptyRecord("products"),
    name: marker + "-product",
    slug: marker + "-product",
    concernIds: concerns.map((record) => record.id),
    images: [image],
    variants: [{ ...emptyVariant, sku: marker, price: 100, stock: 5 }],
    seo: {
      ...emptySeo,
      title: "Concern product verification",
      description: "Temporary product verification",
    },
  };
  const legacy = { ...productData };
  delete (legacy as Record<string, unknown>).concernIds;
  assert.deepEqual(schemas.products.parse(legacy).concernIds, []);
  assert.equal(
    (await request("products", null, 0, productData, "publish")).status,
    400,
    "Cannot publish products linked to draft concerns",
  );
  assert.equal(
    (
      await request(
        "concerns",
        first.id,
        first.version,
        { ...first.data, seo: { ...emptySeo } },
        "publish",
      )
    ).status,
    400,
    "Concern publish needs SEO",
  );
  for (const concern of concerns)
    await save("concerns", concern.data, "publish", concern);
  const empty = await save(
    "concerns",
    { ...first.data, name: marker + "-empty", slug: marker + "-empty" },
    "publish",
  );
  const product = await save("products", productData, "publish");
  let home = await get("/");
  assert.ok(home.body.includes('id="shop-by-concern"'));
  assert.ok(home.body.includes('href="' + path + '"'));
  assert.ok(
    !home.body.includes('href="/concerns/' + empty.data.slug + '"'),
    "Empty concerns must be absent from homepage",
  );
  let page = await get(path);
  assert.equal(page.status, 200);
  assert.ok(page.body.includes("<title>Concern verification 0</title>"));
  assert.ok(page.body.includes('href="/products/' + productData.slug + '"'));
  assert.ok(page.body.includes("/concerns/" + first.data.slug));
  const sitemap = await get("/sitemap.xml");
  assert.ok(sitemap.body.includes(path));
  assert.ok(
    !sitemap.body.includes("/concerns/" + concerns[4]!.data.slug),
    "No-index concerns must stay out of sitemap",
  );
  const settings = await db.content.findFirst({
    where: { kind: "settings", slug: "site" },
  });
  if (process.env.CONCERN_BROWSER_SCRIPT)
    execFileSync(process.execPath, [process.env.CONCERN_BROWSER_SCRIPT], {
      stdio: "inherit",
      env: {
        ...process.env,
        CONCERN_PATH: path,
        CONCERN_PRODUCT_ID: product.id,
        CONCERN_ID: first.id,
        CONCERN_SETTINGS_ID: settings?.id ?? "",
      },
    });
  await save(
    "concerns",
    { ...first.data, name: marker + "-draft" },
    "save",
    first,
  );
  assert.ok((await get(path)).body.includes("<h1"));
  assert.ok(!(await get(path)).body.includes(">" + marker + "-draft</h1>"));
  await save("concerns", { ...first.data, enabled: false }, "publish", first);
  assert.equal(
    (await get(path)).status,
    404,
    "Hidden concern must be unavailable publicly",
  );
  assert.equal(
    (await get(path, previewCookie)).status,
    200,
    "Hidden concern must remain previewable",
  );
  home = await get("/");
  assert.ok(!home.body.includes('href="' + path + '"'));
  assert.ok(!(await get("/sitemap.xml")).body.includes(path));
  assert.equal(
    (
      await request(
        "concerns",
        first.id,
        first.version,
        first.data,
        "unpublish",
      )
    ).status,
    400,
    "Linked concern unpublish must be blocked",
  );
  await save("products", product.data, "unpublish", product);
  await save("concerns", first.data, "unpublish", first);
  assert.equal((await get(path)).status, 404);
  console.log(
    "PASS: legacy defaults, references, draft privacy/preview, SEO, homepage assignment, empty/hidden concerns, sitemap, publish cache refresh and unpublish protection",
  );
} finally {
  const ids = created.map((record) => record.id);
  if (ids.length) {
    await db.revision.deleteMany({ where: { contentId: { in: ids } } });
    await db.content.deleteMany({ where: { id: { in: ids } } });
  }
  await fetch(store + "/api/cms-revalidate", {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.CMS_CONTENT_TOKEN },
  }).catch(() => {});
  await db.$disconnect();
}
