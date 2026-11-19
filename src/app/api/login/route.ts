import { NextResponse } from "next/server";
import { scryptSync, createHash } from "node:crypto";
import { checkOrigin, equal, session } from "@/lib/auth";
import { db } from "@/lib/db";
export async function POST(request: Request) {
  try {
    await checkOrigin();
    const form = await request.formData();
    const password = String(form.get("password") ?? "");
    const key = createHash("sha256").update("admin").digest("hex");
    const attempt = await db.loginAttempt.findUnique({ where: { key } });
    if (attempt && attempt.resetAt > new Date() && attempt.failures >= 10)
      return NextResponse.redirect(
        new URL(
          "/login?error=Wait%2015%20minutes%20before%20trying%20again",
          request.url,
        ),
        303,
      );
    const [salt, hash] = (process.env.CMS_PASSWORD_HASH ?? "").split(":");
    if (!salt || !hash) throw Error("Login is not configured");
    if (
      password.length > 300 ||
      !equal(scryptSync(password, salt, 64).toString("hex"), hash)
    ) {
      const expired = !attempt || attempt.resetAt < new Date();
      await db.loginAttempt.upsert({
        where: { key },
        create: { key, failures: 1, resetAt: new Date(Date.now() + 900000) },
        update: expired
          ? { failures: 1, resetAt: new Date(Date.now() + 900000) }
          : { failures: { increment: 1 } },
      });
      return NextResponse.redirect(
        new URL("/login?error=Incorrect%20password", request.url),
        303,
      );
    }
    await db.loginAttempt.deleteMany({ where: { key } });
    await session();
    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch {
    return NextResponse.redirect(
      new URL("/login?error=Unable%20to%20sign%20in", request.url),
      303,
    );
  }
}
