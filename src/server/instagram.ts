import type { InstagramData, InstagramPost } from "@/types";
import { getSettings } from "./settings";

type GraphMedia = {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
};

type GraphProfile = {
  username?: string;
  followers_count?: number;
  media_count?: number;
  profile_picture_url?: string;
};

const demoPosts: InstagramPost[] = [
  {
    id: "demo-1",
    caption: "Soft pink structured gel set",
    mediaType: "IMAGE",
    mediaUrl: "https://images.unsplash.com/photo-1612887390768-fb02affea7a6?auto=format&fit=crop&w=900&q=85",
    permalink: "https://www.instagram.com/nuneznails_/",
    timestamp: new Date().toISOString(),
    likeCount: 287,
    commentsCount: 18,
    reach: 5100,
  },
  {
    id: "demo-2",
    caption: "Colorful detail manicure",
    mediaType: "IMAGE",
    mediaUrl: "https://images.unsplash.com/photo-1571290274554-6a2eaa771e5f?auto=format&fit=crop&w=900&q=85",
    permalink: "https://www.instagram.com/nuneznails_/",
    timestamp: new Date().toISOString(),
    likeCount: 391,
    commentsCount: 22,
    reach: 6800,
  },
  {
    id: "demo-3",
    caption: "Chrome accent set",
    mediaType: "REELS",
    mediaUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?auto=format&fit=crop&w=900&q=85",
    permalink: "https://www.instagram.com/nuneznails_/",
    timestamp: new Date().toISOString(),
    likeCount: 442,
    commentsCount: 37,
    plays: 12400,
    reach: 8700,
  },
  {
    id: "demo-4",
    caption: "Fresh manicure appointment",
    mediaType: "VIDEO",
    mediaUrl: "https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=900&q=85",
    permalink: "https://www.instagram.com/nuneznails_/",
    timestamp: new Date().toISOString(),
    likeCount: 318,
    commentsCount: 16,
    plays: 9800,
    reach: 6200,
  },
  {
    id: "demo-5",
    caption: "Nude almond nails",
    mediaType: "REELS",
    mediaUrl: "https://images.unsplash.com/photo-1610992015732-2449b76344bc?auto=format&fit=crop&w=900&q=85",
    permalink: "https://www.instagram.com/nuneznails_/",
    timestamp: new Date().toISOString(),
    likeCount: 275,
    commentsCount: 11,
    plays: 15700,
    reach: 7200,
  },
];

function graphUrl(version: string, path: string, params: Record<string, string | number>) {
  const url = new URL(`https://graph.facebook.com/${version || "v23.0"}/${path}`);

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));

  return url;
}

async function graphGet<T>(token: string, version: string, path: string, params: Record<string, string | number>) {
  const response = await fetch(graphUrl(version, path, { ...params, access_token: token }), {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Instagram Graph API error ${response.status}`);
  }

  return (await response.json()) as T;
}

function demoInstagramData(note?: string): InstagramData {
  const totals = demoPosts.reduce(
    (sum, post) => ({
      likes: sum.likes + post.likeCount,
      comments: sum.comments + post.commentsCount,
      plays: sum.plays + (post.plays ?? 0),
      reach: sum.reach + (post.reach ?? 0),
    }),
    { likes: 0, comments: 0, plays: 0, reach: 0 },
  );

  return {
    source: "demo",
    handle: "nuneznails_",
    profileUrl: "https://www.instagram.com/nuneznails_/",
    followersCount: 3842,
    mediaCount: 128,
    profilePictureUrl: demoPosts[0].mediaUrl,
    posts: demoPosts,
    totals,
    statusNote: note ?? "Add Instagram Graph API credentials to show live posts and metrics.",
  };
}

async function getMediaInsights(token: string, version: string, mediaId: string, mediaType: string) {
  const metric = mediaType === "VIDEO" || mediaType === "REELS" ? "plays,reach" : "reach";

  try {
    const payload = await graphGet<{ data?: { name: string; values?: { value?: number }[] }[] }>(token, version, `${mediaId}/insights`, {
      metric,
    });

    return Object.fromEntries(
      (payload.data ?? []).map((entry) => [entry.name, Number(entry.values?.[0]?.value ?? 0)]),
    ) as { plays?: number; reach?: number };
  } catch {
    return {};
  }
}

export async function getInstagramData(): Promise<InstagramData> {
  const ig = (await getSettings()).integrations.instagram;
  const igUserId = ig.userId;

  if (!igUserId || !ig.accessToken) {
    return demoInstagramData();
  }

  try {
    const [profile, mediaPayload] = await Promise.all([
      graphGet<GraphProfile>(ig.accessToken, ig.graphVersion, igUserId, {
        fields: "username,followers_count,media_count,profile_picture_url",
      }),
      graphGet<{ data?: GraphMedia[] }>(ig.accessToken, ig.graphVersion, `${igUserId}/media`, {
        fields: "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
        limit: 12,
      }),
    ]);

    const posts = await Promise.all(
      (mediaPayload.data ?? [])
        .filter((item) => item.media_url || item.thumbnail_url)
        .map(async (item) => {
          const mediaType = item.media_product_type === "REELS" ? "REELS" : item.media_type ?? "IMAGE";
          const insights = await getMediaInsights(ig.accessToken, ig.graphVersion, item.id, mediaType);

          return {
            id: item.id,
            caption: item.caption ?? "",
            mediaType,
            mediaUrl: item.media_url ?? item.thumbnail_url ?? "",
            thumbnailUrl: item.thumbnail_url,
            permalink: item.permalink ?? `https://www.instagram.com/${profile.username ?? "nuneznails_"}/`,
            timestamp: item.timestamp ?? new Date().toISOString(),
            likeCount: item.like_count ?? 0,
            commentsCount: item.comments_count ?? 0,
            plays: insights.plays,
            reach: insights.reach,
          };
        }),
    );

    const totals = posts.reduce(
      (sum, post) => ({
        likes: sum.likes + post.likeCount,
        comments: sum.comments + post.commentsCount,
        plays: sum.plays + (post.plays ?? 0),
        reach: sum.reach + (post.reach ?? 0),
      }),
      { likes: 0, comments: 0, plays: 0, reach: 0 },
    );

    return {
      source: "instagram",
      handle: profile.username ?? "nuneznails_",
      profileUrl: `https://www.instagram.com/${profile.username ?? "nuneznails_"}/`,
      followersCount: profile.followers_count ?? 0,
      mediaCount: profile.media_count ?? posts.length,
      profilePictureUrl: profile.profile_picture_url,
      posts,
      totals,
    };
  } catch (error) {
    return demoInstagramData(error instanceof Error ? error.message : "Instagram API request failed.");
  }
}
