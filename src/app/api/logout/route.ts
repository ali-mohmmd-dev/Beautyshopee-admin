import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { checkOrigin } from "@/lib/auth";
export async function POST(request: Request) {
  await checkOrigin();
  (await cookies()).delete("cms-session");
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
