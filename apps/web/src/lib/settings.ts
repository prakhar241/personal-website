import prisma from "./prisma";

export type SiteSettings = Record<string, string>;

/** Default values — always returned for missing keys so the site works without seeding */
const DEFAULT_SETTINGS: SiteSettings = {
  site_name: "My Blog",
  site_tagline: "Developer & Builder",
  site_description: "Personal blog about software development",
  hero_greeting: "Hey, I'm",
  hero_highlight: "a developer",
  hero_suffix: "with flavour.",
  hero_description:
    "Welcome to my corner of the internet. I write about software development, technology, and the things I'm building. Grab a coffee and stay a while.",
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
};

/**
 * Fetch all site settings as a key-value object.
 * Missing keys are filled from DEFAULT_SETTINGS so the site always renders.
 */
export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const settings = await prisma.siteSetting.findMany();
    const dbMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as SiteSettings);
    // Merge: DB values win, defaults fill gaps
    return { ...DEFAULT_SETTINGS, ...dbMap };
  } catch (error) {
    console.warn("getSiteSettings: Could not fetch from database, using defaults");
    return { ...DEFAULT_SETTINGS };
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
export async function getSetting(key: string, fallback?: string): Promise<string> {
  try {
    const setting = await prisma.siteSetting.findUnique({ where: { key } });
    return setting?.value ?? fallback ?? DEFAULT_SETTINGS[key] ?? "";
  } catch {
    return fallback ?? DEFAULT_SETTINGS[key] ?? "";
  }
}
