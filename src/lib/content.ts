import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "./db";
import { schemas, type Kind } from "./model";
export class Conflict extends Error {}
export async function saveContent(
  kind: Kind,
  id: string | null,
  data: unknown,
  version: number,
  action: "save" | "publish" | "unpublish",
) {
  const parsed = schemas[kind].parse(data);
  const json = parsed as unknown as Prisma.InputJsonValue;
  return db.$transaction(
    async (tx) => {
      for (const [key, expected] of [
        ["brandId", "brands"],
        ["companyId", "companies"],
        ["parentId", "categories"],
        ["productId", "products"],
      ] as const) {
        const value = (parsed as Record<string, unknown>)[key];
        if (value) {
          if (value === id) throw Error("A record cannot refer to itself");
          const target = await tx.content.findFirst({
            where: { id: String(value), kind: expected, archivedAt: null },
          });
          if (!target)
            throw Error("Referenced " + expected + " record does not exist");
          if (action === "publish" && !target.published)
            throw Error("Publish the linked " + expected + " record first");
          if (key === "parentId") {
            let parent = target;
            const visited = new Set<string>(id ? [id] : []);
            while (parent) {
              if (visited.has(parent.id))
                throw Error("Category parents cannot form a cycle");
              visited.add(parent.id);
              const parentId = (parent.draft as Record<string, unknown>)
                .parentId;
              if (!parentId) break;
              const next = await tx.content.findUnique({
                where: { id: String(parentId) },
              });
              if (!next) break;
              parent = next;
            }
          }
        }
      }
      const categoryIds = (parsed as Record<string, unknown>).categoryIds;
      if (Array.isArray(categoryIds)) {
        const matches = await tx.content.count({
          where: {
            kind: "categories",
            id: { in: categoryIds },
            archivedAt: null,
            ...(action === "publish"
              ? { published: { not: Prisma.DbNull } }
              : {}),
          },
        });
        if (matches !== new Set(categoryIds).size)
          throw Error(
            "Choose valid " +
              (action === "publish" ? "published " : "") +
              "categories",
          );
      }
      if (kind === "products") {
        const skus = (
          parsed as unknown as { variants: { sku: string }[] }
        ).variants.map((v) => v.sku.toLowerCase());
        const products = await tx.content.findMany({
          where: { kind: "products", id: { not: id ?? "" }, archivedAt: null },
        });
        for (const product of products) {
          const variants =
            (product.draft as { variants?: { sku: string }[] }).variants ?? [];
          if (variants.some((v) => skus.includes(v.sku.toLowerCase())))
            throw Error("SKU is already used by another product");
        }
      }
      if (kind === "pages") {
        const pages = await tx.content.findMany({
          where: { kind: "pages", id: { not: id ?? "" }, archivedAt: null },
        });
        if (
          pages.some(
            (page) =>
              (page.draft as { path: string }).path ===
              (parsed as unknown as { path: string }).path,
          )
        )
          throw Error("A page already uses this storefront path");
      }
      if (action === "publish") {
        if (
          !["reviews", "companies"].includes(kind) &&
          (!parsed.seo.title.trim() || !parsed.seo.description.trim())
        )
          throw Error("Add an SEO title and description before publishing");
        const images: Record<string, unknown>[] = [];
        function collect(value: unknown) {
          if (!value || typeof value !== "object") return;
          if (Array.isArray(value)) return value.forEach(collect);
          const obj = value as Record<string, unknown>;
          if ("url" in obj && "alt" in obj) images.push(obj);
          Object.values(obj).forEach(collect);
        }
        collect(parsed);
        if (
          images.some(
            (image) =>
              image.url && !image.decorative && !String(image.alt).trim(),
          )
        )
          throw Error("Add alt text to each image or mark it decorative");
        if (
          kind === "products" &&
          !(parsed as unknown as { images: unknown[] }).images.length
        )
          throw Error("Add a product image before publishing");
      }
      if (!id) {
        const record = await tx.content.create({
          data: {
            kind,
            slug: parsed.slug,
            title: parsed.name,
            draft: json,
            published: action === "publish" ? json : undefined,
            publishedAt: action === "publish" ? new Date() : null,
          },
        });
        await tx.revision.create({
          data: { contentId: record.id, version: 1, action, data: json },
        });
        return record;
      }
      if (
        action === "unpublish" &&
        ["brands", "categories", "companies", "products"].includes(kind)
      ) {
        const dependents = await tx.content.findMany({
          where: { published: { not: Prisma.DbNull }, archivedAt: null },
        });
        if (
          dependents.some(
            (record) =>
              record.id !== id &&
              JSON.stringify(record.published).includes(id!),
          )
        )
          throw Error(
            "This record is used by published content. Remove those references before unpublishing.",
          );
      }
      const previous = await tx.content.findUnique({ where: { id } });
      if (!previous || previous.kind !== kind || previous.archivedAt)
        throw Error("Record not found");
      if (previous.published && previous.slug !== parsed.slug)
        throw Error("Published slugs are fixed to preserve existing links");
      const result = await tx.content.updateMany({
        where: { id, version },
        data: {
          slug: parsed.slug,
          title: parsed.name,
          draft: json,
          version: { increment: 1 },
          ...(action === "publish"
            ? { published: json, publishedAt: new Date() }
            : {}),
          ...(action === "unpublish"
            ? { published: Prisma.DbNull, publishedAt: null }
            : {}),
        },
      });
      if (result.count !== 1)
        throw new Conflict(
          "Another editor changed this record. Reload before saving.",
        );
      await tx.revision.create({
        data: { contentId: id, version: version + 1, action, data: json },
      });
      return tx.content.findUniqueOrThrow({ where: { id } });
    },
    { isolationLevel: "Serializable", timeout: 20000 },
  );
}
