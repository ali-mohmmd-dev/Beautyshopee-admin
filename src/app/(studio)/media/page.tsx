import { db } from "@/lib/db";
import { MediaLibrary } from "@/components/media-library";
export default async function MediaPage() {
  const media = await db.media.findMany({
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return <MediaLibrary initialMedia={JSON.parse(JSON.stringify(media))} />;
}
