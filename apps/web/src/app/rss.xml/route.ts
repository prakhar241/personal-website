import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getSiteSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://prakharbansal.in";

// GET /rss.xml - RSS 2.0 feed
export async function GET() {
  try {
    const [posts, settings] = await Promise.all([
      prisma.post.findMany({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 20,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          tags: true,
          author: { select: { name: true } },
        },
      }),
      getSiteSettings(),
    ]);

    const siteName = settings.site_name || "My Blog";
    const siteDescription = settings.site_description || "Personal blog";

    const escapeXml = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const items = posts
      .map((post) => {
        const pubDate = post.publishedAt
          ? new Date(post.publishedAt).toUTCString()
          : new Date().toUTCString();
        const categories = post.tags
          .map((tag) => `      <category>${escapeXml(tag)}</category>`)
          .join("\n");

        return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${BASE_URL}/blogs/${post.slug}</link>
      <guid isPermaLink="true">${BASE_URL}/blogs/${post.slug}</guid>
      <description>${escapeXml(post.excerpt || "")}</description>
      <pubDate>${pubDate}</pubDate>
${categories ? categories + "\n" : ""}      ${post.author?.name ? `<author>${escapeXml(post.author.name)}</author>` : ""}
    </item>`;
      })
      .join("\n");

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${BASE_URL}</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>en</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;

    return new NextResponse(rss, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (error) {
    console.error("RSS feed error:", error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Feed Error</title></channel></rss>',
      {
        headers: { "Content-Type": "application/xml; charset=utf-8" },
        status: 500,
      }
    );
  }
}
