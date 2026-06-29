"use client";

import { useEffect, useMemo, useState } from "react";
import { Camera, ExternalLink, Heart, MessageCircle, Play, UsersRound } from "lucide-react";
import type { InstagramData, InstagramPost } from "@/types";

function compactNumber(value?: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value ?? 0);
}

function postScore(post: InstagramPost) {
  return (post.reach ?? 0) + (post.plays ?? 0) + post.likeCount + post.commentsCount;
}

export function InstagramAdminCard() {
  const [instagram, setInstagram] = useState<InstagramData | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/instagram")
      .then((response) => response.json())
      .then((payload: { instagram?: InstagramData }) => {
        if (active && payload.instagram) {
          setInstagram(payload.instagram);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError("Instagram data could not be loaded.");
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const topPosts = useMemo(() => {
    return [...(instagram?.posts ?? [])].sort((left, right) => postScore(right) - postScore(left)).slice(0, 3);
  }, [instagram]);

  const chartPosts = (instagram?.posts ?? []).slice(0, 7);
  const maxChartValue = Math.max(...chartPosts.map(postScore), 1);

  return (
    <div className="admin-card insights-card instagram-admin-card">
      <div className="admin-card-title">
        <Camera size={18} />
        <span>Instagram insights</span>
        <a href={instagram?.profileUrl ?? "https://www.instagram.com/nuneznails_/"} target="_blank" rel="noreferrer">
          Open
        </a>
      </div>

      {instagram ? (
        <>
          <div className="instagram-admin-profile">
            {instagram.profilePictureUrl ? (
              <img src={instagram.profilePictureUrl} alt="" />
            ) : (
              <span className="instagram-admin-avatar">
                <Camera size={18} />
              </span>
            )}
            <div>
              <h3>@{instagram.handle}</h3>
              <p>{instagram.source === "instagram" ? "Live Graph API data" : "Demo data until API credentials are added"}</p>
            </div>
            <a href={instagram.profileUrl} target="_blank" rel="noreferrer" aria-label="Open Instagram profile">
              <ExternalLink size={17} />
            </a>
          </div>

          <div className="instagram-admin-metrics">
            <article>
              <UsersRound size={16} />
              <span>Followers</span>
              <strong>{compactNumber(instagram.followersCount)}</strong>
            </article>
            <article>
              <Camera size={16} />
              <span>Posts</span>
              <strong>{compactNumber(instagram.mediaCount)}</strong>
            </article>
            <article>
              <Heart size={16} />
              <span>Likes</span>
              <strong>{compactNumber(instagram.totals.likes)}</strong>
            </article>
            <article>
              <Play size={16} />
              <span>Reach</span>
              <strong>{compactNumber(instagram.totals.reach || instagram.totals.plays)}</strong>
            </article>
          </div>

          <div className="insight-chart instagram-live-chart" aria-label="Recent Instagram post performance">
            {chartPosts.length ? (
              chartPosts.map((post) => (
                <span key={post.id} style={{ height: `${Math.max(18, (postScore(post) / maxChartValue) * 100)}%` }} />
              ))
            ) : (
              <span style={{ height: "42%" }} />
            )}
          </div>

          <div className="instagram-admin-posts">
            {topPosts.map((post) => (
              <a key={post.id} href={post.permalink} target="_blank" rel="noreferrer">
                <img src={post.thumbnailUrl ?? post.mediaUrl} alt="" />
                <span>
                  <strong>{post.caption || "Instagram post"}</strong>
                  <small>
                    <Heart size={13} /> {compactNumber(post.likeCount)}
                    <MessageCircle size={13} /> {compactNumber(post.commentsCount)}
                  </small>
                </span>
              </a>
            ))}
          </div>

          {instagram.statusNote ? <p className="instagram-source-note">{instagram.statusNote}</p> : null}
        </>
      ) : (
        <p className="instagram-source-note">{loadError || "Loading Instagram posts and metrics..."}</p>
      )}
    </div>
  );
}
