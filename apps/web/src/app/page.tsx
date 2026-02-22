import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import prisma from "@/lib/prisma";
import { strings } from "@/lib/strings";

export const dynamic = 'force-dynamic';
import { PostCard } from "@/components/blog/PostCard";
import { ArrowRight } from "lucide-react";

export default async function HomePage() {
  const recentPosts = await prisma.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 5,
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
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="mx-auto max-w-5xl px-4 py-16 md:py-24">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            {strings.home.heroGreeting}{" "}
            <span className="text-brand-500">{strings.home.heroHighlight}</span>
            <br />
            {strings.home.heroSuffix}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            {strings.home.heroDescription}
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
            >
              {strings.home.readBlog}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              {strings.home.aboutMe}
            </Link>
          </div>
        </section>

        {/* Recent Posts */}
        <section className="mx-auto max-w-5xl px-4 pb-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {strings.home.recentPosts}
            </h2>
            <Link
              href="/blog"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1"
            >
              {strings.common.viewAll}
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentPosts.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {recentPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">
              {strings.home.noPostsYet}
            </p>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
