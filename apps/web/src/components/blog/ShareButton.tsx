"use client";

import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { trackShare } from "@/lib/telemetry";
import { strings } from "@/lib/strings";

interface ShareButtonProps {
  url: string;
  title: string;
}

export function ShareButton({ url, title }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        trackShare(url, "native");
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare(url, "clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 rounded-lg bg-muted px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      aria-label="Share this post"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-green-500" />
          <span>{strings.share.linkCopied}</span>
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" />
          <span>{strings.share.share}</span>
        </>
      )}
    </button>
  );
}
