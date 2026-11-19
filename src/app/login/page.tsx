import { redirect } from "next/navigation";
import { loggedIn } from "@/lib/auth";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await loggedIn()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="login">
      <div className="login-card">
        <p className="eyebrow">BEAUTYSHOPEE · STUDIO</p>
        <h1>
          A little care.
          <br />
          Every detail.
        </h1>
        <p className="muted">
          Sign in to manage your collection and storefront.
        </p>
        <form action="/api/login" method="post">
          <label>
            Studio password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <button className="primary">Sign in to studio →</button>
        </form>
      </div>
    </main>
  );
}
