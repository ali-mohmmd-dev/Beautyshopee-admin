import Link from "next/link";
import { redirect } from "next/navigation";
import { loggedIn } from "@/lib/auth";
const links = [
  ["/", "Overview"],
  ["/content/products", "Products"],
  ["/content/categories", "Categories"],
  ["/content/brands", "Brands"],
  ["/content/companies", "Companies"],
  ["/content/pages", "Pages & SEO"],
  ["/media", "Media library"],
  ["/content/settings", "Navigation & footer"],
  ["/content/reviews", "Reviews"],
];
export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await loggedIn())) redirect("/login");
  return (
    <div className="studio">
      <aside className="sidebar">
        <Link className="wordmark" href="/">
          Beautyshopee<span>CONTENT STUDIO</span>
        </Link>
        <nav>
          {links.map(([href, label]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <a
            href={process.env.STOREFRONT_URL ?? "http://localhost:3000"}
            target="_blank"
            rel="noreferrer"
          >
            Visit storefront ↗
          </a>
          <form action="/api/logout" method="post">
            <button>Sign out</button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>YOUR STORE, THOUGHTFULLY CURATED</span>
          <span className="avatar">BS</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
