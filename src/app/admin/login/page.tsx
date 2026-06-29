import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { ensureAdminSeed, getSession } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/admin") ? next : "/admin";

  if (session?.role === "admin") {
    redirect(nextPath);
  }

  const settings = await getSettings();
  await ensureAdminSeed(settings.location.ownerEmail);

  const usingDefaultPassword = !process.env.ADMIN_PASSWORD;
  const adminEmail = (process.env.ADMIN_EMAIL || settings.location.ownerEmail).toLowerCase();

  return (
    <main>
      <AuthForm
        mode="admin-login"
        nextPath={nextPath}
        title={`${settings.branding.studioName} admin`}
        subtitle="Sign in to manage appointments, services, and your site."
      />
      {usingDefaultPassword ? (
        <p className="auth-hint">
          First time here? Sign in with <strong>{adminEmail}</strong> and the default password{" "}
          <strong>admin1234</strong>, then change it in Settings. Set an <code>ADMIN_PASSWORD</code> env var to
          override this default.
        </p>
      ) : null}
    </main>
  );
}
