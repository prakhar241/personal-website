import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { subscribeSchema } from "@/lib/validations";
import { sendVerificationEmail } from "@/lib/email";
import { randomUUID } from "crypto";

// POST /api/subscribe - subscribe to blog notifications
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, notifyMode } = subscribeSchema.parse(body);
    const normalizedEmail = email.toLowerCase().trim();

    // Check if already subscribed
    const existing = await prisma.subscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      if (existing.verified) {
        // Don't leak subscription status — return generic success
        return NextResponse.json({
          message: "If this email is not already subscribed, a verification email has been sent.",
        });
      }

      // Unverified — regenerate token and resend
      const newToken = randomUUID();
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: { verifyToken: newToken, notifyMode },
      });

      sendVerificationEmail(normalizedEmail, newToken).catch((err) =>
        console.error("Failed to resend verification email:", err)
      );

      return NextResponse.json({
        message: "If this email is not already subscribed, a verification email has been sent.",
      });
    }

    // Create new subscriber
    const subscriber = await prisma.subscriber.create({
      data: {
        email: normalizedEmail,
        notifyMode,
      },
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(normalizedEmail, subscriber.verifyToken).catch(
      (err) => console.error("Failed to send verification email:", err)
    );

    return NextResponse.json({
      message: "If this email is not already subscribed, a verification email has been sent.",
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    console.error("Subscribe error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
