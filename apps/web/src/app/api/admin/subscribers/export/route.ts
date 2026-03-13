import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/subscribers/export - export verified subscribers as CSV
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscribers = await prisma.subscriber.findMany({
    where: { verified: true },
    orderBy: { subscribedAt: "desc" },
    select: { email: true, notifyMode: true, subscribedAt: true },
  });

  const csvHeader = "email,notifyMode,subscribedAt";
  const csvRows = subscribers.map(
    (s) =>
      `${s.email},${s.notifyMode},${s.subscribedAt?.toISOString() || ""}`
  );
  const csv = [csvHeader, ...csvRows].join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="subscribers-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
