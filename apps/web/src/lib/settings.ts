import prisma from "./prisma";

export type SiteSettings = Record<string, string>;

/**
 * Fetch all site settings as a key-value object
 * Results are cached for the duration of the request
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const settings = await prisma.siteSetting.findMany();
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as SiteSettings);
  } catch (error) {
    // Return defaults if DB is unavailable (build time)
    console.warn("getSiteSettings: Could not fetch from database, using defaults");
    return getDefaultSettings();
  }
}

/**
 * Fetch settings for a specific group
 */
export async function getSettingsByGroup(group: string): Promise<SiteSettings> {
  try {
    const settings = await prisma.siteSetting.findMany({
      where: { group },
      orderBy: { sortOrder: "asc" },
    });
    return settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as SiteSettings);
  } catch (error) {
    return {};
  }
}

/**
 * Get a single setting value with fallback
 */
export async function getSetting(key: string, fallback: string = ""): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key } });
    return setting?.value ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Default settings fallback (used during build time when DB is unavailable)
 */
function getDefaultSettings(): SiteSettings {
  return {
    site_name: "My Blog",
    site_tagline: "Developer & Builder",
    site_description: "Personal blog about software development",
    hero_greeting: "Hey, I'm",
    hero_name: "Developer",
    hero_highlight: "a developer",
    hero_suffix: "with flavour.",
    hero_description: "Welcome to my corner of the internet. I write about software development, technology, and the things I'm building. Grab a coffee and stay a while.",
    hero_cta_primary: "Read the Blog",
    hero_cta_secondary: "Contact Me",
    footer_text: "Built with",
    footer_copyright: "All rights reserved.",
    social_github: "",
    social_linkedin: "",
    social_twitter: "",
    social_email: "",
    seo_title: "Personal Blog",
    seo_description: "A personal blog about technology",
    seo_keywords: "blog, developer, technology",
    contact_title: "Contact",
    contact_content: "# Contact Me\n\nI'd love to hear from you!\n\n## Email\n\nDrop me a line at **your-email@example.com**\n\n## Social\n\n- [GitHub](https://github.com/yourusername)\n- [LinkedIn](https://linkedin.com/in/yourusername)\n- [Twitter](https://twitter.com/yourusername)",
  };
}
