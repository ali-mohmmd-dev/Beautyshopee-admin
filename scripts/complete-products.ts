import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import ts from "typescript";
import { emptyImage, emptyRecord, emptySeo } from "../src/lib/model";
process.loadEnvFile(".env");
const db = new PrismaClient();
async function main() {
  const code = ts.transpileModule(
    fs.readFileSync(
      "../tirur-beauty-bloom-shop-main/src/features/storefront/store-info.ts",
      "utf8",
    ),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } },
  ).outputText;
  const exports: Record<string, any> = {};
  new Function("exports", code)(exports);
  for (const [index, review] of exports.REVIEWS.entries()) {
    const slug = "store-review-" + index;
    const data = {
      ...emptyRecord("reviews"),
      name: review.name,
      slug,
      productId: "",
      author: review.name,
      rating: review.stars,
      text: review.text,
      sample: false,
      date: "",
      seo: { ...emptySeo, title: review.name, description: "Store review" },
    };
    await db.content.upsert({
      where: { kind_slug: { kind: "reviews", slug } },
      create: {
        kind: "reviews",
        slug,
        title: review.name,
        draft: data,
        published: data,
        publishedAt: new Date(),
      },
      update: {},
    });
  }
  for (const record of await db.content.findMany({
    where: { kind: "products" },
  })) {
    const data = record.draft as Record<string, any>;
    if (data.bundleItems) continue;
    data.bundleItems =
      record.slug === "essentials-kit"
        ? [
            ["Velvet Matte Lipstick", "Terracotta 04", 699, "product-trio"],
            ["Blush Compact Duo", "Rose Mist", 849, "product-blush"],
            ["Silk Lip Oil", "Peach Nectar", 649, "product-lip"],
            ["Everyday Mascara", "Intense Black", 499, "product-must"],
          ].map(([name, shade, price, image]) => ({
            name,
            shade,
            price,
            image: {
              ...emptyImage,
              url:
                process.env.R2_PUBLIC_URL +
                "/imported/src/assets/" +
                image +
                ".jpg",
              alt: String(name),
            },
          }))
        : [];
    await db.content.update({
      where: { id: record.id },
      data: { draft: data, published: data },
    });
  }
  console.log("Bundle contents and store review editing imported.");
}
main().finally(() => db.$disconnect());
