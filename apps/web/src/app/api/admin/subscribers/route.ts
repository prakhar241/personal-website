import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/admin/subscribers - list subscribers with pagination & filtering
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const filter = searchParams.get("filter") || "all"; // all | verified | unverified
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (filter === "verified") where.verified = true;
  if (filter === "unverified") where.verified = false;
  if (search) {
    where.email = { contains: search, mode: "insensitive" };
  }

  const [subscribers, total, totalVerified, totalUnverified] =
    await Promise.all([
      prisma.subscriber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.subscriber.count({ where }),
      prisma.subscriber.count({ where: { verified: true } }),
      prisma.subscriber.count({ where: { verified: false } }),
    ]);

  return NextResponse.json({
    subscribers,
    stats: {
      total: totalVerified + totalUnverified,
      verified: totalVerified,
      unverified: totalUnverified,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// DELETE /api/admin/subscribers - bulk delete subscribers
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  await prisma.subscriber.deleteMany({
    where: { id: { in: ids } },
  });

  return NextResponse.json({ message: `Deleted ${ids.length} subscriber(s)` });
}
