import type { PinterestData, PinterestPin } from "@/types";
import { getSettings, type PinterestConfig } from "./settings";

type PinterestImage = {
  url?: string;
  width?: number;
  height?: number;
};

type PinterestApiPin = {
  id: string;
  title?: string;
  description?: string;
  link?: string;
  board_id?: string;
  board_owner?: { username?: string };
  created_at?: string;
  media?: {
    images?: Record<string, PinterestImage>;
  };
};

type PinterestPinPayload = {
  items?: PinterestApiPin[];
};

const demoPins: PinterestPin[] = [
  {
    id: "demo-pin-1",
    title: "Milky chrome almond set",
    description: "Clean neutral base with soft chrome shine.",
    imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "demo-pin-2",
    title: "Minimal French tips",
    description: "Soft pink base with tiny white detail.",
    imageUrl: "https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "demo-pin-3",
    title: "Burgundy glossy extensions",
    description: "High-shine deep red for a polished look.",
    imageUrl: "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "demo-pin-4",
    title: "Gold accent nail art",
    description: "Nude base with tiny gold details.",
    imageUrl: "https://images.unsplash.com/photo-1588359953494-0c215e3cedc6?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "demo-pin-5",
    title: "Clean short manicure",
    description: "Simple, glossy, wearable shape.",
    imageUrl: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
  {
    id: "demo-pin-6",
    title: "Pink cat-eye detail",
    description: "Soft dimension for a private studio set.",
    imageUrl: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85",
    link: "https://www.pinterest.com/",
    boardName: "Nail Inspo",
  },
];

function pinterestData(cfg: PinterestConfig, note?: string): PinterestData {
  return {
    source: "demo",
    profileName: cfg.profileName || "Nunez Nails",
    profileUrl: cfg.profileUrl || "https://www.pinterest.com/",
    pins: demoPins,
    statusNote: note ?? "Add Pinterest API credentials and a board id to show saved nail inspo.",
  };
}

function pinterestApiUrl(path: string, params: Record<string, string | number>) {
  const baseUrl = process.env.PINTEREST_API_BASE_URL ?? "https://api.pinterest.com/v5";
  const url = new URL(`${baseUrl}/${path}`);

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  return url;
}

async function pinterestGet<T>(token: string, path: string, params: Record<string, string | number>) {
  const response = await fetch(pinterestApiUrl(path, params), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error(`Pinterest API error ${response.status}`);
  }

  return (await response.json()) as T;
}

function bestImageUrl(pin: PinterestApiPin) {
  const images = pin.media?.images ?? {};
  const preferred = images["1200x"] ?? images["600x"] ?? images["400x300"] ?? images.orig;
  const firstImage = preferred ?? Object.values(images).find((image) => image.url);

  return firstImage?.url ?? "";
}

export async function getPinterestData(): Promise<PinterestData> {
  const cfg = (await getSettings()).integrations.pinterest;

  if (!cfg.accessToken) {
    return pinterestData(cfg);
  }

  try {
    const path = cfg.boardId ? `boards/${cfg.boardId}/pins` : "pins";
    const payload = await pinterestGet<PinterestPinPayload>(cfg.accessToken, path, {
      page_size: 12,
    });

    const pins = (payload.items ?? [])
      .map((pin) => ({
        id: pin.id,
        title: pin.title ?? "Saved nail inspo",
        description: pin.description,
        imageUrl: bestImageUrl(pin),
        link: pin.link,
        boardName: cfg.boardName || "Nail Inspo",
        savedAt: pin.created_at,
      }))
      .filter((pin) => pin.imageUrl);

    return {
      source: "pinterest",
      profileName: cfg.profileName || "Nunez Nails",
      profileUrl: cfg.profileUrl || "https://www.pinterest.com/",
      pins,
    };
  } catch (error) {
    return pinterestData(cfg, error instanceof Error ? error.message : "Pinterest API request failed.");
  }
}
