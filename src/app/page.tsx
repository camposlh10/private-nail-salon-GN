import { PublicSite } from "@/components/PublicSite";
import { getPublicSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const settings = await getPublicSettings();

  return <PublicSite settings={settings} />;
}
