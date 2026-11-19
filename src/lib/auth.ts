import "server-only";
import { cookies, headers } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
export function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function sign(value: string) {
  const secret = process.env.CMS_SESSION_SECRET;
  if (!secret || secret.length < 32) throw Error("Missing session secret");
  return createHmac("sha256", secret).update(value).digest("hex");
}
export async function loggedIn() {
  const token = (await cookies()).get("cms-session")?.value;
  if (!token) return false;
  const [expiry, signature] = token.split(".");
  return (
    !!expiry &&
    !!signature &&
    Number(expiry) > Date.now() &&
    equal(sign(expiry), signature)
  );
}
export async function requireAdmin() {
  if (!(await loggedIn())) throw Error("Unauthorized");
}
export async function session() {
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  (await cookies()).set("cms-session", expiry + "." + sign(expiry), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}
export async function checkOrigin() {
  const h = await headers(),
    origin = h.get("origin"),
    host = h.get("host");
  if (!origin || new URL(origin).host !== host)
    throw Error("Invalid request origin");
}
