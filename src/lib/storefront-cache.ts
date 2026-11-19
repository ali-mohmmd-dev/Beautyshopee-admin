import "server-only";

export async function refreshStorefront(): Promise<boolean> {
  const origin = process.env.STOREFRONT_URL;
  const secret = process.env.CMS_CONTENT_TOKEN;
  if (!origin || !secret) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(new URL("/api/cms-revalidate", origin), {
        method: "POST",
        headers: { Authorization: "Bearer " + secret },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok && (await response.json()).revalidated === true)
        return true;
    } catch {
      // The database commit has succeeded: report delivery failure separately.
    }
  }
  return false;
}
