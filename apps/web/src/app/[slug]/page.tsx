import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

// Reserved slugs that have their own hardcoded routes
const RESERVED_SLUGS = ['blogs', 'contact', 'admin', 'auth', 'api', 'version', 'rss.xml'];

interface PageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Skip reserved slugs
  if (RESERVED_SLUGS.includes(params.slug)) {
    return {};
  }

  const page = await prisma.staticPage.findUnique({
    where: { slug: params.slug },
    select: { title: true },
  });

  if (!page) {
    return { title: 'Page Not Found' };
  }

  return { title: page.title };
}

export default async function DynamicPage({ params }: PageProps) {
  // Skip reserved slugs - let them 404 so Next.js continues to hardcoded routes
  if (RESERVED_SLUGS.includes(params.slug)) {
    notFound();
  }

  const page = await prisma.staticPage.findUnique({
    where: { slug: params.slug, isVisible: true },
  });

  if (!page) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
        <div
          className="prose prose-lg dark:prose-dark max-w-none"
          dangerouslySetInnerHTML={{ __html: page.htmlContent || page.markdownContent }}
        />
      </main>
      <Footer />
    </div>
  );
}
