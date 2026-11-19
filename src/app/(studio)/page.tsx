import Link from "next/link";
import { db } from "@/lib/db";
export default async function Dashboard() {
  const [products, pages, media, recent] = await Promise.all([
    db.content.count({ where: { kind: "products", archivedAt: null } }),
    db.content.count({ where: { kind: "pages", archivedAt: null } }),
    db.media.count(),
    db.content.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">THE BIG PICTURE</p>
          <h1>Your storefront starts here.</h1>
          <p className="muted">
            Curate the collection. Tell your story. Make every detail count.
          </p>
        </div>
        <Link className="primary" href="/content/products/new">
          + Add product
        </Link>
      </div>
      <div className="stats">
        {[
          [products, "Products", "products"],
          [pages, "Pages", "pages"],
          [media, "Images", "media"],
        ].map(([count, label, key]) => (
          <Link
            className="stat"
            href={key === "media" ? "/media" : "/content/" + key}
            key={key}
          >
            <span>{label}</span>
            <strong>{count}</strong>
            <small>Manage {String(label).toLowerCase()} ↗</small>
          </Link>
        ))}
      </div>
      <div className="section-head">
        <h2>Recently edited</h2>
        <span className="muted">A little progress, every day.</span>
      </div>
      <div className="panel">
        {recent.length ? (
          recent.map((record) => (
            <Link
              className="record-row"
              key={record.id}
              href={"/content/" + record.kind + "/" + record.id}
            >
              <div>
                <strong>{record.title}</strong>
                <small>
                  {record.kind} · /{record.slug}
                </small>
              </div>
              <span className={record.published ? "badge live" : "badge"}>
                {record.published ? "Published" : "Draft"}
              </span>
            </Link>
          ))
        ) : (
          <p className="empty">Start by adding your first product or page.</p>
        )}
      </div>
    </>
  );
}
