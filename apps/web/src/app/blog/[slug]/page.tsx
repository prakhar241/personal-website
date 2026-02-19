import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { LikeButton } from "@/components/blog/LikeButton";
import { ShareButton } from "@/components/blog/ShareButton";
import { CommentSection } from "@/components/blog/CommentSection";
import prisma from "@/lib/prisma";
import { formatDate, readingTime, absoluteUrl } from "@/lib/utils";
import { Clock, Calendar } from "lucide-react";
import type { Metadata } from "next";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug, status: "PUBLISHED" },
    select: { title: true, excerpt: true, coverImageUrl: true },
  });

  if (!post) return { title: "Post Not Found" };

  return {
    title: post.title,
    description: post.excerpt || undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt || undefined,
      type: "article",
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
      url: absoluteUrl(`/blog/${params.slug}`),
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt || undefined,
      images: post.coverImageUrl ? [post.coverImageUrl] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await prisma.post.findUnique({
    where: { slug: params.slug },
    include: {
      author: { select: { name: true, image: true } },
      comments: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { likes: true, comments: true } },
    },
  });

  if (!post || post.status !== "PUBLISHED") {
    notFound();
  }

  // Track page view server-side
  prisma.pageView
    .create({
      data: {
        pagePath: `/blog/${params.slug}`,
        postId: post.id,
      },
    })
    .catch(() => {});

  const shareUrl = absoluteUrl(`/blog/${params.slug}`);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12">
          {/* Header */}
          <header className="mb-8">
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/blog?tag=${encodeURIComponent(tag)}`}
                    className="rounded-full bg-brand-50 dark:bg-brand-950/30 px-3 py-1 text-xs font-medium text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-950/50 transition-colors"
                  >
                    {tag}
                  </a>
                ))}
              </div>
            )}

            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="mt-3 text-lg text-muted-foreground">
                {post.excerpt}
              </p>
            )}

            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              {post.author.name && (
                <span className="font-medium text-foreground">
                  {post.author.name}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {formatDate(post.publishedAt || post.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {readingTime(post.markdownContent)}
              </span>
            </div>
          </header>

          {/* Cover Image */}
          {post.coverImageUrl && (
            <div className="mb-8 overflow-hidden rounded-xl">
              <img
                src={post.coverImageUrl}
                alt={post.title}
                className="w-full object-cover"
              />
            </div>
          )}

          {/* Content */}
          <div
            className="prose prose-lg dark:prose-dark max-w-none prose-headings:scroll-mt-20"
            dangerouslySetInnerHTML={{ __html: post.htmlContent || "" }}
          />

          {/* Actions Bar */}
          <div className="mt-10 flex items-center justify-between border-t border-b border-border/60 py-4">
            <LikeButton
              slug={post.slug}
              initialCount={post._count.likes}
            />
            <ShareButton url={shareUrl} title={post.title} />
          </div>

          {/* Comments */}
          <CommentSection
            slug={post.slug}
            initialComments={post.comments}
          />
        </article>
      </main>
      <Footer />
    </div>
  );
}
