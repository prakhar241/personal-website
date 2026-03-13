import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sendWelcomeEmail } from "@/lib/email";
import { randomUUID } from "crypto";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://prakharbansal.in";

// GET /api/subscribe/verify?token=xxx - verify email subscription
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?subscribed=error", BASE_URL));
  }

  try {
    const subscriber = await prisma.subscriber.findUnique({
      where: { verifyToken: token },
    });

    if (!subscriber) {
      return NextResponse.redirect(new URL("/?subscribed=error", BASE_URL));
    }

    if (subscriber.verified) {
      // Already verified — just redirect
      return NextResponse.redirect(new URL("/?subscribed=true", BASE_URL));
    }

    // Mark as verified
    const unsubscribeToken = randomUUID();
    await prisma.subscriber.update({
      where: { id: subscriber.id },
      data: {
        verified: true,
        subscribedAt: new Date(),
        unsubscribeToken,
      },
    });

    // Send welcome email (non-blocking)
    sendWelcomeEmail(subscriber.email, unsubscribeToken).catch((err) =>
      console.error("Failed to send welcome email:", err)
    );

    return NextResponse.redirect(new URL("/?subscribed=true", BASE_URL));
  } catch (error) {
    console.error("Verify error:", error);
    return NextResponse.redirect(new URL("/?subscribed=error", BASE_URL));
  }
}
