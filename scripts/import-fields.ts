import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { emptyImage } from "../src/lib/model";
process.loadEnvFile(".env");
const db = new PrismaClient();
async function main() {
  const { ledger, groups } = JSON.parse(
    fs.readFileSync("scripts/content-ledger.json", "utf8"),
  );
  const imageUrl = (value: string) =>
    value.startsWith("http")
      ? value
      : process.env.R2_PUBLIC_URL +
        "/imported/" +
        (value.startsWith("/") ? "public" + value : value);
  const settings = await db.content.findUniqueOrThrow({
    where: { kind_slug: { kind: "settings", slug: "site" } },
  });
  const global = settings.draft as Record<string, any>;
  const labels = global.labels ?? [];
  for (const item of ledger.filter((item: any) => item.global)) {
    const name = item.section + "." + item.key;
    const value = item.field === "image" ? imageUrl(item.text) : item.text;
    const existing = labels.find((label: any) => label.name === name);
    if (!existing) labels.push({ name, value });
    else if (item.field === "image" && existing.value.includes("/imported//"))
      existing.value = value;
  }
  const updated = { ...global, labels };
  await db.content.update({
    where: { id: settings.id },
    data: { draft: updated, published: updated },
  });
  for (const [slug, sections] of Object.entries(groups)) {
    const record = await db.content.findUniqueOrThrow({
      where: { kind_slug: { kind: "pages", slug } },
    });
    const data = record.draft as Record<string, any>;
    const blocks = data.blocks ?? [];
    for (const item of ledger.filter(
      (item: any) =>
        !item.global && (sections as string[]).includes(item.section),
    )) {
      const key = item.section + "." + item.key;
      if (blocks.some((block: any) => block.key === key)) continue;
      const url = item.field === "image" ? imageUrl(item.text) : "";
      blocks.push({
        key,
        heading: item.section + " · " + item.key,
        text: item.field === "text" ? item.text : "",
        image: { ...emptyImage, url, alt: item.section.replaceAll("-", " ") },
        link: { label: "", href: "" },
        enabled: true,
        items: [],
      });
    }
    const updated = { ...data, blocks };
    await db.content.update({
      where: { id: record.id },
      data: { draft: updated, published: updated },
    });
  }
  console.log(
    "Imported editable text, links, headings, image placements, and alt text for the storefront.",
  );
}
main().finally(() => db.$disconnect());
