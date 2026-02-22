import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { PostCard } from "@/components/blog/PostCard";
import prisma from "@/lib/prisma";
import { strings } from "@/lib/strings";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: strings.nav.blog,
  description: strings.blog.metaDescription,
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { page?: string; tag?: string };
}) {
  const page = parseInt(searchParams.page || "1");
  const limit = 9;
  const tag = searchParams.tag;

  const where: any = { status: "PUBLISHED" as const };
  if (tag) {
    where.tags = { has: tag };
  }

  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImageUrl: true,
        tags: true,
        publishedAt: true,
        createdAt: true,
        author: { select: { name: true, image: true } },
        _count: { select: { likes: true, comments: true } },
      },
    }),
    prisma.post.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  // Get all unique tags for filter
  const allTags = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    select: { tags: true },
  });
  const uniqueTags = [...new Set(allTags.flatMap((p) => p.tags))].sort();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 mx-auto max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          {strings.blog.title}
        </h1>
        <p className="text-muted-foreground mb-8">
          {strings.blog.description}
        </p>

        {/* Tag Filter */}
        {uniqueTags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-8">
            <a
              href="/blog"
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                !tag
                  ? "bg-brand-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {strings.common.all}
            </a>
            {uniqueTags.map((t) => (
              <a
                key={t}
                href={`/blog?tag=${encodeURIComponent(t)}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  tag === t
                    ? "bg-brand-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {t}
              </a>
            ))}
          </div>
        )}

        {/* Posts Grid */}
        {posts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {tag
                ? `No posts found with tag "${tag}".`
                : strings.home.noPostsYet}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            {page > 1 && (
              <a
                href={`/blog?page=${page - 1}${tag ? `&tag=${tag}` : ""}`}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                {strings.blog.prevPage}
              </a>
            )}
            <span className="text-sm text-muted-foreground px-4">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <a
                href={`/blog?page=${page + 1}${tag ? `&tag=${tag}` : ""}`}
                className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-accent transition-colors"
              >
                {strings.blog.nextPage}
              </a>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
