"use client";

import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { trackLike } from "@/lib/telemetry";

interface LikeButtonProps {
  slug: string;
  initialCount: number;
}

export function LikeButton({ slug, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [fingerprint, setFingerprint] = useState<string>("anonymous");

  useEffect(() => {
    // Get or create visitor fingerprint
    async function getFingerprint() {
      try {
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setFingerprint(result.visitorId);

        // Check if already liked
        const res = await fetch(
          `/api/posts/${slug}/like?fingerprint=${result.visitorId}`
        );
        const data = await res.json();
        setLiked(data.liked);
        setCount(data.count);
      } catch {
        // Fallback to localStorage
        const stored = localStorage.getItem(`fp_${slug}`);
        if (stored) setLiked(true);
      }
    }
    getFingerprint();
  }, [slug]);

  async function handleLike() {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/posts/${slug}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fingerprint }),
      });
      const data = await res.json();
      setLiked(data.liked);
      setCount(data.count);

      if (data.liked) {
        localStorage.setItem(`fp_${slug}`, "1");
        trackLike(slug);
      } else {
        localStorage.removeItem(`fp_${slug}`);
      }
    } catch (err) {
      console.error("Like failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      className={cn(
        "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all",
        liked
          ? "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400"
          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
      aria-label={liked ? "Unlike this post" : "Like this post"}
    >
      <Heart
        className={cn("h-4 w-4 transition-all", liked && "fill-current scale-110")}
      />
      <span>{count}</span>
    </button>
  );
}
