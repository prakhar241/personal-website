import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import prisma from "@/lib/prisma";
import { strings } from "@/lib/strings";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: strings.nav.contact };

export default async function ContactPage() {
  const page = await prisma.staticPage.findUnique({
    where: { slug: "contact" },
  });

  if (!page) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 mx-auto max-w-3xl px-4 py-12">
          <div className="prose dark:prose-dark max-w-none">
            <h1>{strings.contact.title}</h1>
            <p>{strings.contact.fallbackMessage}</p>
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
          dangerouslySetInnerHTML={{ __html: page.htmlContent || page.markdownContent }}
        />
      </main>
      <Footer />
    </div>
  );
}
