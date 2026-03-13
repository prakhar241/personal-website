import { EmailClient } from "@azure/communication-email";
import prisma from "./prisma";
import { renderTemplate } from "./email-templates";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://prakharbansal.in";

// ============================================
// ACS Email Client (singleton)
// ============================================

let emailClient: EmailClient | null = null;

function getEmailClient(): EmailClient {
  if (!emailClient) {
    const connectionString = process.env.ACS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error("ACS_CONNECTION_STRING environment variable is not set");
    }
    emailClient = new EmailClient(connectionString);
  }
  return emailClient;
}

// Sender address configured in ACS
const SENDER_ADDRESS =
  process.env.ACS_SENDER_ADDRESS || "DoNotReply@prakharbansal.in";

// ============================================
// Send a single email via ACS
// ============================================

async function sendEmail(to: string, subject: string, html: string) {
  const client = getEmailClient();
  const poller = await client.beginSend({
    senderAddress: SENDER_ADDRESS,
    content: { subject, html },
    recipients: { to: [{ address: to }] },
  });
  return poller.pollUntilDone();
}

// ============================================
// Send verification email (double opt-in)
// ============================================

export async function sendVerificationEmail(email: string, verifyToken: string) {
  const verifyUrl = `${BASE_URL}/api/subscribe/verify?token=${verifyToken}`;
  const { subject, html } = await renderTemplate("verification", {
    verify_url: verifyUrl,
    subscriber_email: email,
  });
  return sendEmail(email, subject, html);
}

// ============================================
// Send welcome email (after verification)
// ============================================

export async function sendWelcomeEmail(
  email: string,
  unsubscribeToken: string
) {
  const unsubscribeUrl = `${BASE_URL}/api/unsubscribe?token=${unsubscribeToken}`;
  const { subject, html } = await renderTemplate("welcome", {
    unsubscribe_url: unsubscribeUrl,
    subscriber_email: email,
  });
  return sendEmail(email, subject, html);
}

// ============================================
// Send new post notification to one subscriber
// ============================================

export async function sendNewPostNotification(
  subscriberEmail: string,
  unsubscribeToken: string,
  post: { title: string; slug: string; excerpt: string | null; coverImageUrl: string | null; publishedAt: Date | null }
) {
  const postUrl = `${BASE_URL}/blogs/${post.slug}`;
  const unsubscribeUrl = `${BASE_URL}/api/unsubscribe?token=${unsubscribeToken}`;
  const coverHtml = post.coverImageUrl
    ? `<img src="${post.coverImageUrl}" alt="${post.title}" style="width:100%;height:auto;display:block;" />`
    : "";

  const { subject, html } = await renderTemplate("new_post", {
    post_title: post.title,
    post_excerpt: post.excerpt || "",
    post_url: postUrl,
    post_cover_image_html: coverHtml,
    post_date: post.publishedAt
      ? post.publishedAt.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "",
    unsubscribe_url: unsubscribeUrl,
    subscriber_email: subscriberEmail,
  });

  return sendEmail(subscriberEmail, subject, html);
}

// ============================================
// Send notifications to all instant subscribers
// (fire-and-forget, non-blocking)
// ============================================

export async function sendBulkPostNotifications(post: {
  title: string;
  slug: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
}) {
  const subscribers = await prisma.subscriber.findMany({
    where: {
      verified: true,
      notifyMode: { in: ["INSTANT", "BOTH"] },
      unsubscribeToken: { not: null },
    },
  });

  if (subscribers.length === 0) return;

  // Send emails in parallel with concurrency limit
  const BATCH_SIZE = 10;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    await Promise.allSettled(
      batch.map((sub) =>
        sendNewPostNotification(sub.email, sub.unsubscribeToken!, post)
      )
    );
  }
}

// ============================================
// Send digest email to one subscriber
// ============================================

export async function sendDigestEmail(
  subscriberEmail: string,
  unsubscribeToken: string,
  posts: Array<{ title: string; slug: string; excerpt: string | null }>,
  digestPeriod: string
) {
  const unsubscribeUrl = `${BASE_URL}/api/unsubscribe?token=${unsubscribeToken}`;

  const postsHtml = posts
    .map(
      (p) => `
    <div style="border-left:3px solid #0ea5e9;padding:12px 16px;margin:0 0 16px;background:#f0f9ff;border-radius:0 8px 8px 0;">
      <h3 style="margin:0 0 4px;font-size:16px;">
        <a href="${BASE_URL}/blogs/${p.slug}" style="color:#111827;text-decoration:none;">${p.title}</a>
      </h3>
      <p style="margin:0;color:#6b7280;font-size:13px;">${p.excerpt || ""}</p>
    </div>`
    )
    .join("\n");

  const { subject, html } = await renderTemplate("rss_digest", {
    posts_html: postsHtml,
    digest_period: digestPeriod,
    unsubscribe_url: unsubscribeUrl,
    subscriber_email: subscriberEmail,
  });

  return sendEmail(subscriberEmail, subject, html);
}

// ============================================
// Send digest to all digest subscribers
// ============================================

export async function sendBulkDigestEmails(
  posts: Array<{ title: string; slug: string; excerpt: string | null }>,
  digestPeriod: string
) {
  const subscribers = await prisma.subscriber.findMany({
    where: {
      verified: true,
      notifyMode: { in: ["DIGEST", "BOTH"] },
      unsubscribeToken: { not: null },
    },
  });

  if (subscribers.length === 0) return 0;

  const BATCH_SIZE = 10;
  let sent = 0;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((sub) =>
        sendDigestEmail(sub.email, sub.unsubscribeToken!, posts, digestPeriod)
      )
    );
    sent += results.filter((r) => r.status === "fulfilled").length;
  }

  return sent;
}
