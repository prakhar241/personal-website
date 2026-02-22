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
      slug: "about",
      title: "About Me",
      sortOrder: 1,
      markdownContent: `# About Me

Hi! I'm a software developer with a flavour for building elegant solutions.

## What I Do

I specialize in full-stack development, cloud architecture, and DevOps.

## Skills

- TypeScript / JavaScript
- React / Next.js
- Node.js
- Azure Cloud Services
- Kubernetes & Docker
- CI/CD & Infrastructure as Code

## Get in Touch

Feel free to reach out via the contact page or connect on social media.
`,
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
