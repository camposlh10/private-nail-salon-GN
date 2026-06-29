import { getSettings } from "./settings";

export type StudioConfig = {
  name: string;
  ownerName: string;
  ownerEmail: string;
  emailFrom: string;
  phone: string;
  email: string;
  locationName: string;
  address: string;
  mapsUrl: string;
  mapImageUrl?: string;
  timezone: string;
  instagramUrl: string;
  primaryColor: string;
  accentColor: string;
};

export function mapsUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

export function staticMapImageUrl(address: string, key?: string) {
  if (!key) return undefined;

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", address);
  url.searchParams.set("zoom", "15");
  url.searchParams.set("size", "640x260");
  url.searchParams.set("scale", "2");
  url.searchParams.set("markers", `color:pink|${address}`);
  url.searchParams.set("key", key);

  return url.toString();
}

/** Studio config, derived from the persistent settings store (admin-editable). */
export async function getStudioConfig(): Promise<StudioConfig> {
  const settings = await getSettings();
  const address = settings.location.address;
  const mapsKey = settings.integrations.google.mapsStaticApiKey;

  return {
    name: settings.branding.studioName,
    ownerName: settings.branding.ownerName,
    ownerEmail: settings.location.ownerEmail,
    emailFrom: settings.integrations.smtp.from || settings.location.emailFrom,
    phone: settings.location.phone,
    email: settings.location.email,
    locationName: settings.location.locationName,
    address,
    mapsUrl: mapsUrl(address),
    mapImageUrl: staticMapImageUrl(address, mapsKey) || settings.location.mapImageUrl || undefined,
    timezone: settings.location.timezone,
    instagramUrl: settings.location.instagramUrl,
    primaryColor: settings.branding.primaryColor,
    accentColor: settings.branding.accentColor,
  };
}
