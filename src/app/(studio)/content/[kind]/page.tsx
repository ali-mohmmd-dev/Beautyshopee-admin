import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { kinds, type Kind } from "@/lib/model";
export default async function Records({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { kind } = await params;
  if (!kinds.includes(kind as Kind)) notFound();
  const { q = "" } = await searchParams;
  const records = await db.content.findMany({
    where: {
      kind,
      archivedAt: null,
      ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
    },
    // List rows do not need the full draft and published document snapshots.
    select: {
      id: true,
      title: true,
      slug: true,
      version: true,
      publishedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">YOUR STOREFRONT</p>
          <h1 className="capitalize">
            {kind === "settings" ? "Navigation & footer" : kind}
          </h1>
          <p className="muted">Edit, preview, and publish at your pace.</p>
        </div>
        <Link className="primary" href={"/content/" + kind + "/new"}>
          + Add {kind === "settings" ? "settings" : kind.slice(0, -1)}
        </Link>
      </div>
      <form className="search">
        <input
          name="q"
          defaultValue={q}
          placeholder={"Search " + kind}
          aria-label={"Search " + kind}
        />
        <button>Search</button>
      </form>
      <div className="panel">
        {records.map((record) => (
          <Link
            className="record-row"
            href={"/content/" + kind + "/" + record.id}
            key={record.id}
          >
            <div>
              <strong>{record.title}</strong>
              <small>
                /{record.slug} · Revision {record.version}
              </small>
            </div>
            <div className="row-end">
              <span className={record.publishedAt ? "badge live" : "badge"}>
                {record.publishedAt ? "Published" : "Draft"}
              </span>
              <span>↗</span>
            </div>
          </Link>
        ))}
        {!records.length && (
          <p className="empty">
            No {kind} found. Add your first record to get started.
          </p>
        )}
      </div>
    </>
  );
}
