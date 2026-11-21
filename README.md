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

## Vercel environment

Configure the server environment variables from `.env.example` in the Vercel project for each deployment environment you use. Local `.env` and `.local-admin.txt` files are deliberately excluded from Git and are not uploaded by a Git deployment. In particular, set pooled `DATABASE_URL`, migration `DIRECT_URL`, `CMS_SESSION_SECRET`, `CMS_PASSWORD_HASH`, `CMS_CONTENT_TOKEN`, the R2 variables, and the deployed `STOREFRONT_URL`. Redeploy after changing deployment variables. The build can import database modules without `DATABASE_URL`; database requests still require a valid runtime connection URL.

## Storefront cache refresh

Set `STOREFRONT_URL` to the live storefront origin and configure the same private `CMS_CONTENT_TOKEN` on both apps. After a publish or unpublish transaction commits, the CMS calls the storefront cache refresh endpoint, retrying once on failure. Saving a draft does not invalidate public content. Delivery failure returns the committed record version and a visible warning, so retrying publication does not cause a stale-version conflict. Published content has a 60-second fallback expiry on the storefront. Existing visitor tabs need a reload to pick up changed client-side content.

With production test servers on ports 3100 (storefront) and 3101 (CMS, `STOREFRONT_URL=http://localhost:3100`), run `npx tsx scripts/cache-smoke.ts` to verify cache reuse, draft isolation, private previews, authentication, publishing, and unpublishing. The test creates and removes a temporary page.

## Shop by concern

Create concerns under **Shop by concern** with a name, slug, description, image/alt text and SEO fields. Publish each concern, then select it in a product’s **Concerns** field and publish the product. Products can belong to several concerns. In **Navigation & footer → Shop by concern — homepage**, edit heading, intro and visibility, choose concerns, and use the up/down buttons to order them. An empty selection automatically includes all enabled concerns that have published products. Empty concerns stay off the homepage. Turning off **Visible on website** on a concern and publishing hides its public page, homepage card and sitemap entry; preview still works. Unpublishing a concern used by published products/settings is blocked until its references are removed. No database migration is needed: concerns use the existing versioned content records.

Run `npx tsx scripts/concerns-smoke.ts` against the production test servers on ports 3100/3101 to verify concern publishing, previews, references, SEO, visibility, and cache refresh. It creates and removes temporary records. Optional browser checks can be supplied through `CONCERN_BROWSER_SCRIPT`.

## Homepage banners

Open Pages & SEO → Home → Content → Homepage hero banners. Choose a wide Desktop banner image and a separate Mobile banner image (1:1 square) using the thumbnail pickers. Both placements have independent image metadata. Save draft for preview, then Publish to refresh the storefront cache. Mobile screens below 768px use the square image; larger screens use the desktop artwork. `scripts/install-hero-banners.ts` registers the bundled artwork in R2 and updates only those homepage fields, preserving other draft and published values.
