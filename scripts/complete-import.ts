import { PrismaClient } from "@prisma/client";
import { emptyImage } from "../src/lib/model";
process.loadEnvFile(".env");
const db = new PrismaClient();
async function main() {
  for (const slug of ["face", "eyes", "lips", "nails", "looks"]) {
    const record = await db.content.findUnique({
      where: { kind_slug: { kind: "categories", slug } },
    });
    if (!record) continue;
    const data = record.draft as Record<string, any>;
    if (data.image?.url) continue;
    const value = {
      ...data,
      image: {
        ...emptyImage,
        url:
          process.env.R2_PUBLIC_URL +
          "/imported/src/assets/cat-" +
          slug +
          ".jpg",
        alt: data.name,
      },
    };
    await db.content.update({
      where: { id: record.id },
      data: { draft: value, published: value },
    });
  }
  console.log("Category artwork connected.");
}
main().finally(() => db.$disconnect());
