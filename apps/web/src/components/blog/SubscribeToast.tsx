"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

export function SubscribeToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const subscribed = searchParams.get("subscribed");
    const unsubscribed = searchParams.get("unsubscribed");

    if (subscribed === "true") {
      toast.success("Email verified! You're now subscribed.");
      // Clean up URL
      window.history.replaceState({}, "", "/");
    } else if (subscribed === "error") {
      toast.error("Verification failed. The link may be invalid or expired.");
      window.history.replaceState({}, "", "/");
    }

    if (unsubscribed === "true") {
      toast.success("You've been unsubscribed. Sorry to see you go!");
      window.history.replaceState({}, "", "/");
    } else if (unsubscribed === "error") {
      toast.error("Unsubscribe failed. Please try again.");
      window.history.replaceState({}, "", "/");
    }
  }, [searchParams]);

  return null;
}
