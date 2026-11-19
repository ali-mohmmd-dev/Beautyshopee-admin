import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { emptyImage } from "../src/lib/model";
process.loadEnvFile(".env");
const db = new PrismaClient();
async function main() {
  const extras = JSON.parse(
    fs.readFileSync("scripts/extra-fields.json", "utf8"),
  );
  for (const slug of ["home", "about"]) {
    const record = await db.content.findUniqueOrThrow({
      where: { kind_slug: { kind: "pages", slug } },
    });
    const data = record.draft as Record<string, any>;
    for (const extra of extras)
      if (
        !data.blocks.some(
          (block: any) => block.key === extra.section + "." + extra.key,
        )
      )
        data.blocks.push({
          key: extra.section + "." + extra.key,
          heading: "Store benefits",
          text: "",
          image: emptyImage,
          link: { label: "", href: "" },
          enabled: true,
          items: extra.items,
        });
    await db.content.update({
      where: { id: record.id },
      data: { draft: data, published: data },
    });
  }
  const settings = await db.content.findUniqueOrThrow({
    where: { kind_slug: { kind: "settings", slug: "site" } },
  });
  const data = settings.draft as Record<string, any>;
  if (!data.footerImages.length) {
    data.footerImages = [
      "product-blush",
      "cat-eyes",
      "product-lip",
      "cat-nails",
      "product-trio",
      "cat-lips",
      "product-must",
      "bundle",
    ].map((name) => ({
      ...emptyImage,
      url: process.env.R2_PUBLIC_URL + "/imported/src/assets/" + name + ".jpg",
      alt: name.replaceAll("-", " "),
    }));
    await db.content.update({
      where: { id: settings.id },
      data: { draft: data, published: data },
    });
  }
  console.log("Footer image strip and store benefit copy imported.");
}
main().finally(() => db.$disconnect());
