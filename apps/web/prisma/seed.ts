import { PrismaClient, Role, PostStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Hash the admin password from env (required - no fallback for security)
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD environment variable is required");
  }
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    throw new Error("ADMIN_EMAIL environment variable is required");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  // Create admin user with credentials
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash, role: Role.ADMIN },
    create: {
      email: adminEmail,
      name: "Prakhar Bansal",
      role: Role.ADMIN,
      passwordHash,
    },
  });

  // Create sample blog posts
  const posts = [
    {
      title: "Welcome to My Blog",
      slug: "welcome-to-my-blog",
      excerpt: "This is my first blog post. Welcome!",
      markdownContent: `# Welcome to My Blog

Hello and welcome! This is my very first blog post on this platform.

## What to Expect

I'll be sharing my thoughts on:

- **Software Development** — tips, patterns, and lessons learned
- **Technology Trends** — what's exciting in the tech world
- **Personal Projects** — things I'm building and experimenting with

## Code Example

Here's a quick TypeScript snippet:

\`\`\`typescript
const greet = (name: string): string => {
  return \`Hello, \${name}! Welcome to my blog.\`;
};

console.log(greet("Reader"));
\`\`\`

## Stay Tuned

More posts coming soon. Feel free to leave a comment below!
`,
      status: PostStatus.PUBLISHED,
      tags: ["welcome", "introduction"],
      publishedAt: new Date(),
    },
    {
      title: "Building a Blog with Next.js and Azure",
      slug: "building-blog-nextjs-azure",
      excerpt:
        "A deep dive into the tech stack behind this blog — Next.js, Prisma, AKS, and more.",
      markdownContent: `# Building a Blog with Next.js and Azure

In this post, I walk through the architecture of this very blog.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | Next.js API Routes, Prisma ORM |
| Database | Azure PostgreSQL Flexible Server |
| Hosting | Azure Kubernetes Service (AKS) |
| CI/CD | GitHub Actions |
| IaC | Bicep / ARM Templates |

## Architecture

The blog follows a monorepo structure using Turborepo...

> More details coming in a future post!
`,
      status: PostStatus.DRAFT,
      tags: ["nextjs", "azure", "architecture"],
      publishedAt: null,
    },
  ];

  for (const post of posts) {
    await prisma.post.upsert({
      where: { slug: post.slug },
      update: {},
      create: {
        ...post,
        authorId: admin.id,
      },
    });
  }

  // Create static pages
  const pages = [
    {
      slug: "blogs",
      title: "Blogs",
      sortOrder: 1,
      markdownContent: "Thoughts, tutorials, and insights on software development.",
    },
    {
      slug: "contact",
      title: "Contact",
      sortOrder: 2,
      markdownContent: `# Contact Me

I'd love to hear from you!

## Email

Drop me a line at **your-email@example.com**

## Social

- [GitHub](https://github.com/yourusername)
- [LinkedIn](https://linkedin.com/in/yourusername)
- [Twitter](https://twitter.com/yourusername)
`,
    },
  ];

  for (const page of pages) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
  }

  // Seed site settings
  const siteSettings = [
    // General
    { key: "site_name", value: "My Blog", type: "text", label: "Site Name", group: "general", sortOrder: 1 },
    { key: "site_tagline", value: "Developer & Builder", type: "text", label: "Tagline", group: "general", sortOrder: 2 },
    { key: "site_description", value: "Personal blog about software development", type: "text", label: "Description", group: "general", sortOrder: 3 },
    // Hero
    { key: "hero_greeting", value: "Hey, I'm", type: "text", label: "Hero Greeting", group: "hero", sortOrder: 1 },
    { key: "hero_highlight", value: "a software developer", type: "text", label: "Hero Highlight (colored text)", group: "hero", sortOrder: 2 },
    { key: "hero_suffix", value: "with flavour.", type: "text", label: "Hero Suffix", group: "hero", sortOrder: 3 },
    { key: "hero_description", value: "Welcome to my corner of the internet. I write about software development, technology, and the things I'm building. Grab a coffee and stay a while.", type: "richtext", label: "Hero Description", group: "hero", sortOrder: 4 },
    { key: "hero_cta_primary", value: "Read the Blog", type: "text", label: "Primary Button Text", group: "hero", sortOrder: 5 },
    { key: "hero_cta_secondary", value: "Contact Me", type: "text", label: "Secondary Button Text", group: "hero", sortOrder: 6 },
    // Footer
    { key: "footer_text", value: "Built with", type: "text", label: "Footer Text", group: "footer", sortOrder: 1 },
    { key: "footer_copyright", value: "All rights reserved.", type: "text", label: "Copyright Text", group: "footer", sortOrder: 2 },
    // Social
    { key: "social_github", value: "", type: "text", label: "GitHub URL", group: "social", sortOrder: 1 },
    { key: "social_linkedin", value: "", type: "text", label: "LinkedIn URL", group: "social", sortOrder: 2 },
    { key: "social_twitter", value: "", type: "text", label: "Twitter URL", group: "social", sortOrder: 3 },
    { key: "social_email", value: "", type: "text", label: "Email Address", group: "social", sortOrder: 4 },
    // SEO
    { key: "seo_title", value: "Personal Blog", type: "text", label: "SEO Title", group: "seo", sortOrder: 1 },
    { key: "seo_description", value: "A personal blog about technology", type: "text", label: "SEO Description", group: "seo", sortOrder: 2 },
    { key: "seo_keywords", value: "blog, developer, technology", type: "text", label: "SEO Keywords", group: "seo", sortOrder: 3 },
  ];

  for (const setting of siteSettings) {
    await prisma.siteSetting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  // Seed navigation links
  const navLinks = [
    { label: "Blogs", href: "/blogs", sortOrder: 10, isVisible: true, isSystem: true, openInNewTab: false },
    { label: "Contact", href: "/contact", sortOrder: 110, isVisible: true, isSystem: false, openInNewTab: false },
  ];

  for (const link of navLinks) {
    const existing = await prisma.navLink.findFirst({ where: { href: link.href } });
    if (!existing) {
      await prisma.navLink.create({ data: link });
    }
  }

  console.log("✅ Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
