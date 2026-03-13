import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://prakharbansal.in";

// GET /api/unsubscribe?token=xxx - unsubscribe from notifications
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?unsubscribed=error", BASE_URL));
  }

  try {
    const subscriber = await prisma.subscriber.findUnique({
      where: { unsubscribeToken: token },
    });

    if (!subscriber) {
      // Token invalid or already unsubscribed — still redirect gracefully
      return NextResponse.redirect(new URL("/?unsubscribed=true", BASE_URL));
    }

    await prisma.subscriber.delete({ where: { id: subscriber.id } });

    return NextResponse.redirect(new URL("/?unsubscribed=true", BASE_URL));
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.redirect(new URL("/?unsubscribed=error", BASE_URL));
  }
}
