import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";
import { randomUUID } from "crypto";

// DELETE /api/admin/subscribers/[id] - delete single subscriber
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { id: params.id },
  });
  if (!subscriber) {
    return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  }

  await prisma.subscriber.delete({ where: { id: params.id } });
  return NextResponse.json({ message: "Subscriber deleted" });
}

// POST /api/admin/subscribers/[id] - resend verification email
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscriber = await prisma.subscriber.findUnique({
    where: { id: params.id },
  });
  if (!subscriber) {
    return NextResponse.json({ error: "Subscriber not found" }, { status: 404 });
  }
  if (subscriber.verified) {
    return NextResponse.json(
      { error: "Subscriber is already verified" },
      { status: 400 }
    );
  }

  // Regenerate token and resend
  const newToken = randomUUID();
  await prisma.subscriber.update({
    where: { id: params.id },
    data: { verifyToken: newToken },
  });

  try {
    await sendVerificationEmail(subscriber.email, newToken);
    return NextResponse.json({ message: "Verification email resent" });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
