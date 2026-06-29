import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSession } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const nextPath = next && next.startsWith("/account") ? next : "/account";
  const session = await getSession();

  if (session) {
    redirect(nextPath);
  }

  const settings = await getSettings();

  return (
    <main>
      <AuthForm
        mode="client-login"
        nextPath={nextPath}
        title={`Welcome back`}
        subtitle={`Sign in to manage your ${settings.branding.studioName} appointments.`}
      />
    </main>
  );
}
