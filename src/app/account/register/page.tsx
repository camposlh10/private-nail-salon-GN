import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getSession } from "@/server/auth";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function ClientRegisterPage({
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
        mode="client-register"
        nextPath={nextPath}
        title={`Create your account`}
        subtitle={`Book faster and keep track of your visits at ${settings.branding.studioName}.`}
      />
    </main>
  );
}
