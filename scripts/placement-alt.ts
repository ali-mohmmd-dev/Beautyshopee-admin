import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
process.loadEnvFile(".env");
const db = new PrismaClient();
const { ledger } = JSON.parse(
  fs.readFileSync("scripts/content-ledger.json", "utf8"),
);
async function main() {
  for (const record of await db.content.findMany({
    where: { kind: "pages" },
  })) {
    const data = record.draft as Record<string, any>;
    let changed = false;
    for (const block of data.blocks ?? []) {
      if (!block.image?.url) continue;
      const section = block.key.split(".")[0];
      const index = Number(block.key.split("-").at(-1));
      const alt = ledger.find(
        (entry: any) =>
          entry.section === section && entry.key === "alt-" + (index + 1),
      );
      if (alt && block.image.alt === section.replaceAll("-", " ")) {
        block.image.alt = alt.text;
        changed = true;
      }
    }
    if (changed)
      await db.content.update({
        where: { id: record.id },
        data: { draft: data, published: data },
      });
  }
  console.log(
    "Imported image placement alt text matched to original descriptions.",
  );
}
main().finally(() => db.$disconnect());
