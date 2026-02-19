import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact" };

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
            <h1>Contact</h1>
            <p>This page hasn&apos;t been set up yet. Log in as admin to create it.</p>
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
