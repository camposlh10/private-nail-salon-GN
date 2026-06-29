import { getSettings } from "./settings";
import { listClientReviews } from "./repository";

export type PublicReview = {
  author: string;
  rating: number;
  text: string;
  relativeTime?: string;
  profilePhoto?: string;
};

export type ReviewsResult = {
  source: "google" | "manual";
  rating: number;
  total: number;
  reviews: PublicReview[];
};

type GooglePlaceDetails = {
  result?: {
    rating?: number;
    user_ratings_total?: number;
    reviews?: {
      author_name: string;
      rating: number;
      text: string;
      relative_time_description?: string;
      profile_photo_url?: string;
    }[];
  };
  status?: string;
  error_message?: string;
};

/**
 * Reviews for the public site. Pulls live Google reviews when the studio has
 * chosen "google" mode and provided a Places API key + Place ID; otherwise
 * returns the manually entered reviews from Settings.
 */
export async function getReviews(): Promise<ReviewsResult> {
  const settings = await getSettings();
  const reviews = settings.reviews;
  const apiKey = settings.integrations.google.placesApiKey;
  const clientReviews = await listClientReviews();
  const clientAsPublic: PublicReview[] = clientReviews.map((review) => ({ author: review.name || "Client", rating: review.rating, text: review.text }));

  if (reviews.mode === "google" && apiKey && reviews.googlePlaceId) {
    try {
      const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      url.searchParams.set("place_id", reviews.googlePlaceId);
      url.searchParams.set("fields", "rating,user_ratings_total,reviews");
      url.searchParams.set("reviews_sort", "newest");
      url.searchParams.set("key", apiKey);

      const response = await fetch(url, { next: { revalidate: 600 } });
      const data = (await response.json()) as GooglePlaceDetails;

      if (response.ok && data.result) {
        const googleReviews = (data.result.reviews ?? []).map((review) => ({
          author: review.author_name,
          rating: review.rating,
          text: review.text,
          relativeTime: review.relative_time_description,
          profilePhoto: review.profile_photo_url,
        }));
        return {
          source: "google",
          rating: data.result.rating ?? reviews.headlineRating,
          total: (data.result.user_ratings_total ?? reviews.totalCount) + clientReviews.length,
          reviews: [...clientAsPublic, ...googleReviews],
        };
      }
    } catch {
      // fall through to manual
    }
  }

  const manual = reviews.manual.map((review) => ({
    author: review.author,
    rating: review.rating,
    text: review.text,
  }));

  return {
    source: "manual",
    rating: reviews.headlineRating,
    total: (reviews.totalCount || 0) + clientReviews.length,
    reviews: [...clientAsPublic, ...manual],
  };
}
