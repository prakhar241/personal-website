import { NextResponse } from "next/server";

export async function GET() {
  const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA || process.env.COMMIT_SHA || "local";
  
  return new NextResponse(commitSha, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
}
