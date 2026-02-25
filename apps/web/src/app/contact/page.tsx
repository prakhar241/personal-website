import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import prisma from "@/lib/prisma";
import { markdownToHtml } from "@/lib/markdown";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const page = await prisma.staticPage.findUnique({
    where: { slug: "contact" },
    select: { title: true },
  });
  return { title: page?.title || "Contact" };
}

export default async function ContactPage() {
  const page = await prisma.staticPage.findUnique({
    where: { slug: "contact" },
  });

  const htmlContent = page?.markdownContent
    ? await markdownToHtml(page.markdownContent)
    : "";

  if (!page || !htmlContent) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
          <div className="prose dark:prose-dark max-w-none">
            <h1>Contact</h1>
            <p>This page hasn&apos;t been set up yet. Go to Admin &gt; Pages to create a &quot;contact&quot; page.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
        <div
          className="prose prose-lg dark:prose-dark max-w-none"
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </main>
      <Footer />
    </div>
  );
}
