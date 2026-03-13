import prisma from "./prisma";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://prakharbansal.in";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Prakhar's Blog";

// ============================================
// Default HTML templates for each email type
// ============================================

const DEFAULT_TEMPLATES: Record<string, { subject: string; htmlBody: string }> = {
  verification: {
    subject: "Confirm your subscription to {{site_name}}",
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0ea5e9;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">{{site_name}}</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">Confirm your subscription</h2>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
        Thanks for subscribing! Please click the button below to verify your email address and start receiving notifications about new posts.
      </p>
      <a href="{{verify_url}}" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Verify Email Address
      </a>
      <p style="color:#9ca3af;font-size:13px;margin:24px 0 0;line-height:1.5;">
        If you didn't subscribe to {{site_name}}, you can safely ignore this email.
      </p>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">{{site_name}} &middot; {{site_url}}</p>
    </div>
  </div>
</body>
</html>`,
  },

  welcome: {
    subject: "Welcome! You're subscribed to {{site_name}}",
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0ea5e9;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">{{site_name}}</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">You're all set! 🎉</h2>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 16px;">
        Your subscription to <strong>{{site_name}}</strong> is now confirmed. You'll receive an email whenever a new blog post is published.
      </p>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
        In the meantime, check out the latest posts on the blog:
      </p>
      <a href="{{site_url}}/blogs" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Visit the Blog
      </a>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot; {{site_name}}
      </p>
    </div>
  </div>
</body>
</html>`,
  },

  new_post: {
    subject: "New post: {{post_title}}",
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0ea5e9;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">{{site_name}}</h1>
    </div>
    {{post_cover_image_html}}
    <div style="padding:32px;">
      <p style="color:#6b7280;font-size:13px;margin:0 0 8px;">New blog post</p>
      <h2 style="margin:0 0 16px;color:#111827;font-size:22px;">
        <a href="{{post_url}}" style="color:#111827;text-decoration:none;">{{post_title}}</a>
      </h2>
      <p style="color:#4b5563;line-height:1.6;margin:0 0 24px;">
        {{post_excerpt}}
      </p>
      <a href="{{post_url}}" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">
        Read the Post
      </a>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot; {{site_name}}
      </p>
    </div>
  </div>
</body>
</html>`,
  },

  rss_digest: {
    subject: "Weekly digest from {{site_name}}",
    htmlBody: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;">
  <div style="max-width:560px;margin:40px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#0ea5e9;padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">{{site_name}}</h1>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;color:#111827;font-size:22px;">Weekly Digest</h2>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px;">{{digest_period}}</p>
      {{posts_html}}
      <a href="{{site_url}}/blogs" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-top:16px;">
        Visit the Blog
      </a>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a> &middot; {{site_name}}
      </p>
    </div>
  </div>
</body>
</html>`,
  },
};

// ============================================
// Template variable reference (for admin UI)
// ============================================

export const TEMPLATE_VARIABLES: Record<string, string[]> = {
  verification: ["site_name", "site_url", "verify_url", "subscriber_email"],
  welcome: ["site_name", "site_url", "unsubscribe_url", "subscriber_email"],
  new_post: [
    "site_name",
    "site_url",
    "post_title",
    "post_excerpt",
    "post_url",
    "post_cover_image_html",
    "post_date",
    "unsubscribe_url",
    "subscriber_email",
  ],
  rss_digest: [
    "site_name",
    "site_url",
    "posts_html",
    "digest_period",
    "unsubscribe_url",
    "subscriber_email",
  ],
};

export const TEMPLATE_KEYS = Object.keys(DEFAULT_TEMPLATES);

// ============================================
// Get default template by key
// ============================================

export function getDefaultTemplate(templateKey: string) {
  return DEFAULT_TEMPLATES[templateKey] || null;
}

// ============================================
// Ensure all default templates exist in DB
// ============================================

export async function ensureDefaultTemplates() {
  for (const [key, defaults] of Object.entries(DEFAULT_TEMPLATES)) {
    await prisma.emailTemplate.upsert({
      where: { templateKey: key },
      create: {
        templateKey: key,
        subject: defaults.subject,
        htmlBody: defaults.htmlBody,
      },
      update: {}, // Don't overwrite customizations
    });
  }
}

// ============================================
// Render a template with variable substitution
// ============================================

export async function renderTemplate(
  templateKey: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string }> {
  // Try DB first, fall back to coded defaults
  let subject: string;
  let htmlBody: string;

  const dbTemplate = await prisma.emailTemplate.findUnique({
    where: { templateKey },
  });

  if (dbTemplate && dbTemplate.isActive) {
    subject = dbTemplate.subject;
    htmlBody = dbTemplate.htmlBody;
  } else {
    const defaults = DEFAULT_TEMPLATES[templateKey];
    if (!defaults) {
      throw new Error(`Unknown email template: ${templateKey}`);
    }
    subject = defaults.subject;
    htmlBody = defaults.htmlBody;
  }

  // Always inject common variables
  const allVars: Record<string, string> = {
    site_name: SITE_NAME,
    site_url: BASE_URL,
    ...variables,
  };

  // Replace {{variable}} placeholders
  const replacePlaceholders = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => allVars[key] ?? "");

  return {
    subject: replacePlaceholders(subject),
    html: replacePlaceholders(htmlBody),
  };
}

// ============================================
// Render with sample data (for admin preview)
// ============================================

export function getSampleVariables(templateKey: string): Record<string, string> {
  const common = {
    site_name: SITE_NAME,
    site_url: BASE_URL,
    subscriber_email: "reader@example.com",
    unsubscribe_url: `${BASE_URL}/api/unsubscribe?token=sample-token`,
  };

  switch (templateKey) {
    case "verification":
      return {
        ...common,
        verify_url: `${BASE_URL}/api/subscribe/verify?token=sample-token`,
      };
    case "welcome":
      return common;
    case "new_post":
      return {
        ...common,
        post_title: "Building Event-Driven Telemetry for Next.js",
        post_excerpt:
          "Learn how to build a real-time telemetry pipeline using Azure Event Hubs, Data Explorer, and OpenTelemetry in a Next.js application.",
        post_url: `${BASE_URL}/blogs/building-event-driven-telemetry`,
        post_cover_image_html: `<img src="${BASE_URL}/og-image.png" alt="Post cover" style="width:100%;height:auto;display:block;" />`,
        post_date: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      };
    case "rss_digest":
      return {
        ...common,
        digest_period: "March 6 — March 13, 2026",
        posts_html: `
          <div style="border-left:3px solid #0ea5e9;padding:12px 16px;margin:0 0 16px;background:#f0f9ff;border-radius:0 8px 8px 0;">
            <h3 style="margin:0 0 4px;font-size:16px;"><a href="${BASE_URL}/blogs/sample" style="color:#111827;text-decoration:none;">Sample Blog Post Title</a></h3>
            <p style="margin:0;color:#6b7280;font-size:13px;">A brief description of this sample blog post...</p>
          </div>
          <div style="border-left:3px solid #0ea5e9;padding:12px 16px;margin:0 0 16px;background:#f0f9ff;border-radius:0 8px 8px 0;">
            <h3 style="margin:0 0 4px;font-size:16px;"><a href="${BASE_URL}/blogs/another" style="color:#111827;text-decoration:none;">Another Great Post</a></h3>
            <p style="margin:0;color:#6b7280;font-size:13px;">Another interesting excerpt here...</p>
          </div>`,
      };
    default:
      return common;
  }
}
