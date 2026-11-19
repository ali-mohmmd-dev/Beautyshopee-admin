# Beautyshopee Content Studio

A separate Next.js app for products, variants, page content, SEO, navigation, footer content, reviews, and Cloudflare R2 media.

## Local setup

Use Node.js 22.13 or later.

```sh
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Open http://localhost:3001. The initial administrator password is in `.local-admin.txt`. This file and all real environment files are excluded from Git. The storefront runs in the sibling folder on port 3002 locally because port 3000 is occupied by another app. Use pnpm dev --port 3002 in the storefront folder.

The database and R2 bucket supplied for this project are configured locally. For another environment, fill in the variables shown in `.env.example` using deployment secrets. Use HTTPS for production session cookies. Set the storefront's `NEXT_PUBLIC_SITE_URL` to the live site origin for sitemap URLs.

## Editing and publishing

Save draft preserves the published version. Preview opens the storefront with a draft cookie. Publish updates the content served by the storefront. History can restore an earlier revision into the editor. Version checks prevent concurrent editors from silently overwriting each other.

The Pages editor contains the imported storefront's editable headings, text, image placements, alt text, and links. Existing section keys identify the placement on the website. New standalone content pages use their storefront path and ordered content blocks.

Navigation & footer manages global logos, announcement copy, contact information, navigation links, the footer image strip, popular links, and footer text. Global labels also control reusable interface copy.

Products support a brand, categories, an optional company override, short and full descriptions, quality type, specifications, gallery images, optional bundle contents, and variants. Each variant has a SKU, option pairs such as Shade or Color, optional net quantity and unit, selling price, compare-at price, stock, and an optional image. Imported stock starts at zero because the original site had no inventory counts. Set it before enabling purchases for that variant.

Full descriptions support paragraphs, `##` headings, and lines starting with `- ` for lists. Category attributes describe suggested options. Brand and category records have public landing pages and SEO fields. Reviews can be linked to a product, or left unlinked for store reviews. Sample reviews stay labeled.

Upload PNG, JPEG, or WebP images in Media library. Files are uploaded to R2 through authenticated Next.js routes. Each media item stores default alt text, caption, full image text, and decorative status. Selecting an image copies those defaults into a placement, where editors can adjust them independently.

## Database ownership

Prisma uses pooled `DATABASE_URL` for app queries and `DIRECT_URL` for migrations. The CMS runtime caps its Prisma pool at 3 connections per process, waits up to 20 seconds for a pool slot, and allows 10 seconds to establish a connection. Explicit `connection_limit`, `pool_timeout`, and `connect_timeout` parameters in `DATABASE_URL` override these defaults. Budget the combined pools of CMS, storefront, workers, and deployment replicas against the database plan limit. Restart the CMS after changing connection settings; development hot reload deliberately reuses its existing Prisma client. This CMS owns migrations. The storefront has the matching schema and reads published content directly from PostgreSQL on the server. Its API routes provide draft preview. No separate backend application is needed.

The relational `Content` table stores validated document records with draft and published JSON snapshots. Brand, category, company, and review references are validated in transactions. `Revision` and `Media` are separate tables. Published slugs stay fixed to preserve existing links.

## Verification

```sh
npm run typecheck
npm run build
```

`scripts/smoke.ts` verifies authentication, draft isolation, publishing, optimistic concurrency, new product variants, R2 uploads, public images, and image metadata editing. It expects CMS and storefront production servers on ports 3101 and 3100, or the `TEST_CMS_URL` and `TEST_STOREFRONT_URL` variables. It restores edited content and removes temporary test records and uploads.

The initial studio uses one administrator password. Individual staff accounts and roles can be added later.
