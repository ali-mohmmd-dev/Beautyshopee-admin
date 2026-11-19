import { z } from "zod";
export const kinds = [
  "pages",
  "products",
  "categories",
  "brands",
  "companies",
  "settings",
  "reviews",
] as const;
export type Kind = (typeof kinds)[number];
const text = z.string().max(30000);
const short = z.string().max(300);
const slug = z
  .string()
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers, and hyphens",
  )
  .max(120);
export const linkSchema = z.object({
  label: short,
  href: z
    .string()
    .max(2048)
    .refine(
      (value) =>
        !value || /^(\/(?!\/)|#[\w-]|https?:\/\/|tel:|mailto:)/i.test(value),
      "Use an internal path, HTTPS URL, phone, or email link",
    ),
});
export const imageSchema = z.object({
  url: z
    .string()
    .max(2048)
    .refine(
      (value) => !value || /^(\/(?!\/)|https:\/\/)/.test(value),
      "Use a local path or HTTPS URL",
    ),
  alt: short,
  caption: text,
  imageText: text,
  decorative: z.boolean(),
});
export const seoSchema = z.object({
  title: short,
  description: z.string().max(1000),
  canonical: z.string().max(2048),
  socialTitle: short,
  socialDescription: z.string().max(1000),
  socialImage: z.string().max(2048),
  noIndex: z.boolean(),
});
const base = { name: short.min(1), slug, seo: seoSchema };
export const variantSchema = z
  .object({
    sku: z.string().min(1).max(100),
    options: z
      .array(z.object({ name: short.min(1), value: short.min(1) }))
      .max(10),
    netQuantity: z.number().positive().nullable(),
    unit: z.enum(["g", "kg", "ml", "l", "pieces", "none"]),
    price: z.number().nonnegative().max(10000000),
    compareAt: z.number().nonnegative().nullable(),
    stock: z.number().int().nonnegative().max(10000000),
    image: imageSchema,
  })
  .superRefine((v, ctx) => {
    if ((v.unit === "none") !== (v.netQuantity === null))
      ctx.addIssue({
        code: "custom",
        message: "Choose a net quantity and unit together, or leave both empty",
      });
    if (v.compareAt !== null && v.compareAt < v.price)
      ctx.addIssue({
        code: "custom",
        message: "Compare-at price must be at least the selling price",
      });
  });
const blockSchema = z.object({
  key: short.min(1),
  heading: short,
  text,
  image: imageSchema,
  link: linkSchema,
  enabled: z.boolean(),
  items: z
    .array(
      z.object({ title: short, text, image: imageSchema, link: linkSchema }),
    )
    .max(100),
});
export const schemas = {
  products: z
    .object({
      ...base,
      brandId: short,
      categoryIds: z.array(short).max(20),
      companyId: short,
      shortDescription: text,
      description: text,
      qualityType: short,
      specifications: z
        .array(z.object({ name: short.min(1), value: short }))
        .max(50),
      images: z.array(imageSchema).max(30),
      variants: z.array(variantSchema).min(1).max(200),
      bundleItems: z
        .array(
          z.object({
            name: short,
            shade: short,
            price: z.number().nonnegative(),
            image: imageSchema,
          }),
        )
        .max(40)
        .default([]),
      badge: short,
      sample: z.boolean(),
      featured: z.boolean(),
    })
    .superRefine((p, ctx) => {
      if (
        new Set(p.variants.map((v) => v.sku.toLowerCase())).size !==
        p.variants.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Each variant needs a unique SKU",
        });
      const combinations = p.variants.map(
        (v) =>
          JSON.stringify(
            [...v.options]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((o) => [o.name.toLowerCase(), o.value.toLowerCase()]),
          ) +
          ":" +
          v.netQuantity +
          ":" +
          v.unit,
      );
      if (new Set(combinations).size !== combinations.length)
        ctx.addIssue({
          code: "custom",
          message: "Each variant needs a unique combination of options",
        });
    }),
  pages: z.object({
    ...base,
    path: z.string().startsWith("/").max(200),
    blocks: z.array(blockSchema).max(60),
  }),
  brands: z.object({
    ...base,
    description: text,
    companyId: short,
    logo: imageSchema,
    featured: z.boolean(),
    sample: z.boolean(),
  }),
  categories: z.object({
    ...base,
    description: text,
    parentId: short,
    image: imageSchema,
    attributes: z.array(short).max(30),
  }),
  companies: z.object({
    ...base,
    description: text,
    website: z.string().max(2048),
    contact: short,
  }),
  settings: z.object({
    ...base,
    announcement: text,
    logo: imageSchema,
    favicon: imageSchema,
    storeName: short,
    address: text,
    phone: short,
    hours: text,
    directions: z.string().max(2048),
    newsletterHeading: short,
    newsletterText: text,
    copyright: short,
    headerLinks: z.array(linkSchema).max(30),
    footerLinks: z.array(linkSchema).max(60),
    popularLinks: z.array(linkSchema).max(60),
    footerImages: z.array(imageSchema).max(20),
    footerBlocks: z.array(z.object({ heading: short, text })).max(30),
    labels: z.array(z.object({ name: short, value: text })).max(150),
  }),
  reviews: z.object({
    ...base,
    productId: short,
    author: short.min(1),
    rating: z.number().int().min(1).max(5),
    text: text.min(1),
    sample: z.boolean(),
    date: z.string().max(40),
  }),
};
export const emptyImage = {
  url: "",
  alt: "",
  caption: "",
  imageText: "",
  decorative: false,
};
export const emptySeo = {
  title: "",
  description: "",
  canonical: "",
  socialTitle: "",
  socialDescription: "",
  socialImage: "",
  noIndex: false,
};
export const emptyVariant = {
  sku: "",
  options: [],
  netQuantity: null,
  unit: "none",
  price: 0,
  compareAt: null,
  stock: 0,
  image: emptyImage,
};
export function emptyRecord(kind: Kind): Record<string, unknown> {
  const base = { name: "", slug: "", seo: emptySeo };
  switch (kind) {
    case "products":
      return {
        ...base,
        brandId: "",
        categoryIds: [],
        companyId: "",
        shortDescription: "",
        description: "",
        qualityType: "",
        specifications: [],
        images: [],
        variants: [emptyVariant],
        bundleItems: [],
        badge: "",
        sample: false,
        featured: false,
      };
    case "pages":
      return { ...base, path: "/", blocks: [] };
    case "brands":
      return {
        ...base,
        description: "",
        companyId: "",
        logo: emptyImage,
        featured: false,
        sample: false,
      };
    case "categories":
      return {
        ...base,
        description: "",
        parentId: "",
        image: emptyImage,
        attributes: [],
      };
    case "companies":
      return { ...base, description: "", website: "", contact: "" };
    case "reviews":
      return {
        ...base,
        productId: "",
        author: "",
        rating: 5,
        text: "",
        sample: false,
        date: new Date().toISOString().slice(0, 10),
      };
    case "settings":
      return {
        ...base,
        announcement: "",
        logo: emptyImage,
        favicon: emptyImage,
        storeName: "",
        address: "",
        phone: "",
        hours: "",
        directions: "",
        newsletterHeading: "",
        newsletterText: "",
        copyright: "",
        headerLinks: [],
        footerLinks: [],
        popularLinks: [],
        footerImages: [],
        footerBlocks: [],
        labels: [],
      };
  }
}
export type ProductData = z.infer<typeof schemas.products>;
