import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { emptyRecord, emptySeo } from "../src/lib/model";
process.loadEnvFile(".env");
const origin = process.env.TEST_CMS_URL ?? "http://localhost:3101";
const store = process.env.TEST_STOREFRONT_URL ?? "http://localhost:3100";
const url = new URL(process.env.DATABASE_URL!);
url.searchParams.set("connection_limit", "1");
const db = new PrismaClient({ datasourceUrl: url.toString() });
let id = "";
let version = 0;
const token = process.env.CMS_CONTENT_TOKEN!;
const marker = "cache-check-" + Date.now();
const data = {
  ...emptyRecord("pages"),
  name: marker + "-published",
  slug: marker,
  path: "/" + marker,
  seo: {
    ...emptySeo,
    title: "Cache verification",
    description: "Temporary cache verification page",
  },
};
async function refresh(auth = token) {
  return fetch(store + "/api/cms-revalidate", {
    method: "POST",
    headers: { Authorization: "Bearer " + auth },
  });
}
async function html(cookie = "") {
  const r = await fetch(store, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal(r.status, 200);
  return r.text();
}
try {
  assert.equal((await refresh("wrong-token")).status, 401);
  const password = fs
    .readFileSync(".local-admin.txt", "utf8")
    .match(/Password: (.+)/)![1];
  const login = await fetch(origin + "/api/login", {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams({ password }),
    redirect: "manual",
  });
  const cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("cms-session="));
  async function save(action: string) {
    const r = await fetch(origin + "/api/content", {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: origin,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ kind: "pages", id, version, data, action }),
    });
    const result = await r.json();
    assert.equal(r.status, 200, JSON.stringify(result));
    id = result.id;
    version = result.version;
    assert.ok(!result.warning, result.warning);
  }
  await save("publish");
  assert.ok((await html()).includes(data.name));
  // A direct database update simulates an edit whose invalidation has not arrived.
  await db.content.update({
    where: { id },
    data: { published: { ...data, name: marker + "-direct" } },
  });
  for (let i = 0; i < 3; i++) {
    const body = await html();
    assert.ok(body.includes(marker + "-published"));
    assert.ok(!body.includes(marker + "-direct"));
  }
  data.name = marker + "-draft";
  await save("save");
  assert.ok(
    (await html()).includes(marker + "-published"),
    "Saving drafts must not invalidate the public cache",
  );
  const preview = await fetch(
    store + "/api/cms-preview?token=" + encodeURIComponent(token) + "&path=/",
    { redirect: "manual" },
  );
  const previewCookie = preview.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(previewCookie);
  assert.ok((await html(previewCookie)).includes(marker + "-draft"));
  assert.ok(!(await html()).includes(marker + "-draft"));
  assert.equal((await refresh()).status, 200);
  assert.ok(
    (await html()).includes(marker + "-direct"),
    "Explicit invalidation must block for fresh data",
  );
  data.name = marker + "-final";
  await save("publish");
  assert.ok(
    (await html()).includes(marker + "-final"),
    "CMS publish must invalidate automatically",
  );
  await save("unpublish");
  assert.ok(
    !(await html()).includes(marker + "-final"),
    "CMS unpublish must invalidate automatically",
  );
  console.log(
    "PASS: authentication, cross-request cache reuse, draft-save isolation, fresh private preview, immediate invalidation, CMS publish and unpublish",
  );
} finally {
  if (id) {
    await db.revision.deleteMany({ where: { contentId: id } });
    await db.content.delete({ where: { id } });
    await refresh();
  }
  await db.$disconnect();
}
