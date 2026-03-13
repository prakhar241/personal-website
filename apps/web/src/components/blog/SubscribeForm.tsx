"use client";

import { useState } from "react";
import { Mail, Bell, Newspaper, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";

type NotifyMode = "INSTANT" | "DIGEST" | "BOTH";

export function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [notifyMode, setNotifyMode] = useState<NotifyMode>("INSTANT");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), notifyMode }),
      });

      if (res.ok) {
        setSubmitted(true);
        setEmail("");
        toast.success("Check your email to confirm your subscription!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Something went wrong.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Check your inbox!
        </h3>
        <p className="text-sm text-muted-foreground">
          We&apos;ve sent a verification email. Click the link to confirm your
          subscription.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-8">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600/10">
          <Mail className="h-5 w-5 text-brand-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Stay updated
          </h3>
          <p className="text-sm text-muted-foreground">
            Get notified when I publish new posts
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Subscribe"
            )}
          </button>
        </div>

        {/* Notification preference */}
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="notifyMode"
              value="INSTANT"
              checked={notifyMode === "INSTANT"}
              onChange={() => setNotifyMode("INSTANT")}
              className="accent-brand-600"
            />
            <Bell className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Every new post</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="notifyMode"
              value="DIGEST"
              checked={notifyMode === "DIGEST"}
              onChange={() => setNotifyMode("DIGEST")}
              className="accent-brand-600"
            />
            <Newspaper className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">Weekly digest</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="notifyMode"
              value="BOTH"
              checked={notifyMode === "BOTH"}
              onChange={() => setNotifyMode("BOTH")}
              className="accent-brand-600"
            />
            <span className="text-muted-foreground">Both</span>
          </label>
        </div>
      </form>

      <p className="mt-3 text-xs text-muted-foreground">
        No spam, unsubscribe anytime.
      </p>
    </div>
  );
}
