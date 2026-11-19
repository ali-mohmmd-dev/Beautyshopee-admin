import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  emptyImage,
  emptySeo,
  emptyVariant,
  emptyRecord,
  schemas,
  type Kind,
} from "../src/lib/model";
process.loadEnvFile(".env");
const db = new PrismaClient();
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});
const storefront = path.resolve("../tirur-beauty-bloom-shop-main");
const assetUrls = new Map<string, string>();
async function image(filename: string) {
  if (assetUrls.has(filename)) return assetUrls.get(filename)!;
  const file = path.join(storefront, filename);
  if (!fs.existsSync(file)) return filename.startsWith("http") ? filename : "";
  const key = "imported/" + filename.replaceAll("\\", "/");
  const existing = await db.media.findUnique({ where: { key } });
  if (existing) {
    assetUrls.set(filename, existing.url);
    return existing.url;
  }
  const bytes = fs.readFileSync(file);
  const type = filename.endsWith(".png") ? "image/png" : "image/jpeg";
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: type,
      CacheControl: "public,max-age=31536000,immutable",
    }),
  );
  const url = process.env.R2_PUBLIC_URL + "/" + key;
  await db.media.create({
    data: {
      key,
      url,
      filename: path.basename(filename),
      contentType: type,
      size: bytes.length,
    },
  });
  assetUrls.set(filename, url);
  return url;
}
async function insert(kind: Kind, slug: string, data: Record<string, unknown>) {
  const existing = await db.content.findUnique({
    where: { kind_slug: { kind, slug } },
  });
  if (existing) return existing;
  const parsed = schemas[kind].parse(data);
  return db.content.create({
    data: {
      kind,
      slug,
      title: String(data.name),
      draft: parsed as any,
      published: parsed as any,
      publishedAt: new Date(),
      revisions: {
        create: { version: 1, action: "import", data: parsed as any },
      },
    },
  });
}
function loadData(file: string) {
  const code = ts.transpileModule(
    fs.readFileSync(path.join(storefront, file), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const exports: Record<string, any> = {};
  new Function("require", "exports", code)(
    (specifier: string) => ({
      default:
        assetUrls.get("src/" + specifier.replace("@/", "")) ??
        "/" + specifier.replace("@/assets/", "legacy/"),
    }),
    exports,
  );
  return exports;
}
const seo = (title: string, description: string) => ({
  ...emptySeo,
  title,
  description,
});
async function main() {
  for (const name of fs.readdirSync(path.join(storefront, "src/assets")))
    await image("src/assets/" + name);
  await image("public/beauty-shoppee-logo.png");
  const { CATALOG } = loadData("src/features/storefront/catalog.ts");
  const { STORE } = loadData("src/features/storefront/store-info.ts");
  const brands = new Map<string, string>();
  for (const product of CATALOG) {
    if (product.brand && !brands.has(product.brand)) {
      const slug = product.brand.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const record = await insert("brands", slug, {
        ...emptyRecord("brands"),
        name: product.brand,
        slug,
        description: "",
        logo: { ...emptyImage, url: product.image, alt: product.brand },
        sample: Boolean(product.sampleBrand),
        featured: true,
        seo: seo(
          product.brand,
          "Browse " + product.brand + " at Beauty Shoppee Tirur.",
        ),
      });
      brands.set(product.brand, record.id);
    }
  }
  const categories = new Map<string, string>();
  for (const name of ["face", "eyes", "lips", "nails", "sets", "looks"]) {
    const record = await insert("categories", name, {
      ...emptyRecord("categories"),
      name: name[0].toUpperCase() + name.slice(1),
      slug: name,
      attributes: name === "sets" ? ["Shade"] : ["Color", "Shade", "Size"],
      seo: seo(
        name + " products",
        "Explore " + name + " products at Beauty Shoppee Tirur.",
      ),
    });
    categories.set(name, record.id);
  }
  for (const product of CATALOG) {
    const record = await insert("products", product.id, {
      ...emptyRecord("products"),
      name: product.name,
      slug: product.id,
      brandId: brands.get(product.brand) ?? "",
      categoryIds: product.categories
        .map((name: string) => categories.get(name))
        .filter(Boolean),
      shortDescription: product.description,
      description: product.description,
      images: [{ ...emptyImage, url: product.image, alt: product.name }],
      badge: product.tag ?? "",
      sample: Boolean(product.sampleProduct || product.sampleBrand),
      featured: CATALOG.indexOf(product) < 4,
      variants: [
        {
          ...emptyVariant,
          sku: product.id.toUpperCase(),
          price: product.price,
          compareAt: product.bundle?.compareAt ?? null,
          stock: 0,
        },
      ],
      seo: seo(product.name, product.description),
    });
    for (const review of product.reviews ?? []) {
      await insert("reviews", review.id, {
        ...emptyRecord("reviews"),
        name: review.author + " · " + product.name,
        slug: review.id,
        productId: record.id,
        author: review.author,
        rating: review.rating,
        text: review.text,
        sample: Boolean(review.sample),
        date: "",
        seo: seo(
          "Review of " + product.name,
          "Product review for " + product.name,
        ),
      });
    }
  }
  const settings = {
    ...emptyRecord("settings"),
    name: "Site settings",
    slug: "site",
    storeName: STORE.name,
    address: STORE.address,
    phone: STORE.phone,
    hours: STORE.hours,
    directions: STORE.directions,
    announcement:
      "Free delivery on orders above ₹999 · In-store testers in Tirur",
    logo: {
      ...emptyImage,
      url: assetUrls.get("public/beauty-shoppee-logo.png"),
      alt: "Beauty Shoppee",
    },
    favicon: {
      ...emptyImage,
      url: assetUrls.get("public/beauty-shoppee-logo.png"),
      alt: "Beauty Shoppee",
    },
    newsletterHeading: "Beauty letter",
    newsletterText:
      "New arrivals, offers and restocks — straight to your inbox.",
    copyright: "© 2026 Beauty Shoppee Tirur · Kerala 676101",
    headerLinks: [
      { label: "Products", href: "/products" },
      { label: "Categories", href: "/#categories" },
      { label: "Sets", href: "/products/essentials-kit" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
    footerLinks: [
      { label: "Products", href: "/products" },
      { label: "About us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Store hours", href: "/contact#visit" },
    ],
    popularLinks: CATALOG.map((p: any) => ({
      label: p.name,
      href: "/products/" + p.id,
    })),
    footerBlocks: [
      {
        heading: "Shop makeup at Beauty Shoppee Tirur",
        text: "Browse blush compacts, lip oils and everyday makeup sets. Visit our Tirur shop to compare shades in natural light.",
      },
      {
        heading: "Visit the Tirur store",
        text:
          "Find us at " +
          STORE.address +
          ". Call the shop to check product availability and delivery.",
      },
    ],
    labels: [],
    seo: seo(
      "Beauty Shoppee Tirur",
      "Premium cosmetics store in Tirur, Kerala.",
    ),
  };
  await insert("settings", "site", settings);
  for (const [slug, name, route] of [
    ["home", "Home", "/"],
    ["products", "Products", "/products"],
    ["about", "About", "/about"],
    ["contact", "Contact", "/contact"],
  ]) {
    await insert("pages", slug, {
      ...emptyRecord("pages"),
      name,
      slug,
      path: route,
      seo: seo(
        name === "home"
          ? "Beauty Shoppee Tirur — Premium Cosmetics Store"
          : name,
        "Authentic cosmetics, makeup favourites, and in-store shade advice at Beauty Shoppee Tirur.",
      ),
      blocks: [],
    });
  }
  console.log(
    "Imported catalog, page records, store settings, sample reviews, and R2 media. Existing CMS records were preserved.",
  );
}
main().finally(() => db.$disconnect());
