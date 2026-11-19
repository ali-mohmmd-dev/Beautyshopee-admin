import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { kinds, emptyRecord, type Kind } from "@/lib/model";
import { Editor } from "@/components/editor";
export default async function Edit({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (!kinds.includes(kind as Kind)) notFound();
  const record =
    id === "new"
      ? null
      : await db.content.findUnique({
          where: { id },
          include: { revisions: { orderBy: { version: "desc" }, take: 15 } },
        });
  if (id !== "new" && (!record || record.kind !== kind)) notFound();
  const [references, media] = await Promise.all([
    db.content.findMany({
      where: {
        kind: { in: ["brands", "companies", "categories", "products"] },
        archivedAt: null,
      },
      select: { id: true, title: true, kind: true, draft: true },
      orderBy: { title: "asc" },
    }),
    db.media.findMany({ orderBy: { createdAt: "desc" }, take: 300 }),
  ]);
  return (
    <Editor
      kind={kind as Kind}
      recordId={record?.id ?? null}
      initialVersion={record?.version ?? 0}
      initialData={
        (record?.draft ?? emptyRecord(kind as Kind)) as Record<string, unknown>
      }
      published={Boolean(record?.published)}
      references={JSON.parse(JSON.stringify(references))}
      media={JSON.parse(JSON.stringify(media))}
      revisions={JSON.parse(JSON.stringify(record?.revisions ?? []))}
    />
  );
}
