"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Layout,
  Navigation,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";

/* ---------- types ---------- */
interface Setting {
  id: string;
  key: string;
  value: string;
  type: string;
  label: string | null;
  group: string;
  sortOrder: number;
}

interface NavLink {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  isSystem?: boolean;
  openInNewTab?: boolean;
}

type GroupedSettings = Record<string, Setting[]>;

/* ---------- sidebar config ---------- */
const tabs = [
  {
    key: "general",
    label: "General",
    icon: Settings,
    groups: ["general", "footer", "social", "seo"],
    description: "Site name, footer, social links, and SEO",
  },
  {
    key: "homepage",
    label: "Homepage",
    icon: Layout,
    groups: ["hero"],
    description: "Hero section — greeting, description, and buttons",
  },
  {
    key: "navigation",
    label: "Navigation",
    icon: Navigation,
    groups: [],
    description: "Manage header links — add, edit, reorder, or hide",
  },
];

/* sub-group headings shown inside General tab */
const subGroupLabels: Record<string, string> = {
  general: "Site Info",
  footer: "Footer",
  social: "Social Links",
  seo: "SEO",
};

/* ---------- component ---------- */
export default function AdminSettingsPage() {
  const [grouped, setGrouped] = useState<GroupedSettings>({});
  const [activeTab, setActiveTab] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, string>>({});

  // Navigation
  const [navLinks, setNavLinks] = useState<NavLink[]>([]);
  const [navOriginal, setNavOriginal] = useState<NavLink[]>([]);
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchNavLinks();
  }, []);

  /* ---- fetchers ---- */
  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setGrouped(data.grouped);
      }
    } catch {
      toast.error("Failed to load settings");
    }
    setLoading(false);
  }

  async function fetchNavLinks() {
    setNavLoading(true);
    try {
      const res = await fetch("/api/admin/navigation");
      if (res.ok) {
        const data = await res.json();
        setNavLinks(data.links || []);
        setNavOriginal(JSON.parse(JSON.stringify(data.links || [])));
      }
    } catch {
      toast.error("Failed to load navigation links");
    }
    setNavLoading(false);
  }

  /* ---- settings helpers ---- */
  function handleChange(key: string, value: string) {
    setChanges((prev) => ({ ...prev, [key]: value }));
  }

  function getValue(setting: Setting): string {
    return changes[setting.key] ?? setting.value;
  }

  /* ---- nav helpers ---- */
  function updateNavLink(id: string, field: keyof NavLink, value: string | number | boolean) {
    setNavLinks((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [field]: value } : l))
    );
  }

  function addNavLink() {
    const newLink: NavLink = {
      id: `new-${Date.now()}`,
      label: "",
      href: "/",
      sortOrder: Math.max(0, ...navLinks.map((l) => l.sortOrder)) + 10,
      isVisible: true,
    };
    setNavLinks((prev) => [...prev, newLink]);
  }

  function removeNavLink(id: string) {
    setNavLinks((prev) => prev.filter((l) => l.id !== id));
  }

  /** Get edit URL for an internal page link (e.g. /contact → /admin/pages/contact) */
  function getEditUrl(href: string): string | null {
    if (!href.startsWith("/") || href === "/") return null;
    const slug = href.replace(/^\//, "");
    // Skip known app routes that aren't editable static pages
    if (["admin", "auth", "api"].includes(slug)) return null;
    return `/admin/pages/${slug}`;
  }

  function moveNavLink(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= navLinks.length) return;
    const copy = [...navLinks];
    [copy[idx], copy[next]] = [copy[next], copy[idx]];
    copy.forEach((l, i) => (l.sortOrder = (i + 1) * 10));
    setNavLinks(copy);
  }

  /* ---- dirty detection ---- */
  const hasSettingChanges = Object.keys(changes).length > 0;
  const hasNavChanges = JSON.stringify(navLinks) !== JSON.stringify(navOriginal);
  const hasAnyChanges = hasSettingChanges || hasNavChanges;

  /* ---- save ---- */
  async function handleSave() {
    if (!hasAnyChanges) {
      toast("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const promises: Promise<Response>[] = [];

      if (hasSettingChanges) {
        const settings = Object.entries(changes).map(([key, value]) => ({
          key,
          value,
        }));
        promises.push(
          fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ settings }),
          })
        );
      }

      if (hasNavChanges) {
        promises.push(
          fetch("/api/admin/navigation", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ links: navLinks }),
          })
        );
      }

      const results = await Promise.all(promises);
      const allOk = results.every((r) => r.ok);

      if (allOk) {
        toast.success("Settings saved!");
        setChanges({});
        fetchSettings();
        fetchNavLinks();
      } else {
        toast.error("Some changes failed to save");
      }
    } catch {
      toast.error("Failed to save settings");
    }
    setSaving(false);
  }

  /* ---- render helpers ---- */
  const currentTab = tabs.find((t) => t.key === activeTab)!;

  function renderSettingField(setting: Setting) {
    const val = getValue(setting);
    const isChanged = changes[setting.key] !== undefined;
    return (
      <div key={setting.id} className="space-y-1">
        <label
          htmlFor={setting.key}
          className="block text-sm font-medium text-foreground"
        >
          {setting.label || setting.key}
          {isChanged && (
            <span className="ml-2 text-xs text-brand-600">• modified</span>
          )}
        </label>
        {setting.type === "richtext" ? (
          <textarea
            id={setting.key}
            value={val}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            rows={setting.key === "contact_content" ? 12 : 4}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y font-mono"
            placeholder={
              setting.key === "contact_content"
                ? "# Contact Me\n\nWrite your contact page content in Markdown..."
                : ""
            }
          />
        ) : (
          <input
            id={setting.key}
            type={setting.type === "image" ? "url" : "text"}
            value={val}
            onChange={(e) => handleChange(setting.key, e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder={setting.type === "image" ? "https://..." : ""}
          />
        )}
      </div>
    );
  }

  /* ---------- render ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your website content and navigation
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasAnyChanges}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <nav className="w-44 flex-shrink-0 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 rounded-xl border border-border bg-card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              {currentTab.label}
            </h2>
            <p className="text-sm text-muted-foreground">
              {currentTab.description}
            </p>
          </div>

          {/* ===== Navigation Tab ===== */}
          {activeTab === "navigation" ? (
            <div className="space-y-4">
              {navLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {navLinks.map((link, idx) => (
                      <div
                        key={link.id}
                        className="rounded-lg border border-border p-4 space-y-3"
                      >
                        {/* Row 1: reorder + label + href */}
                        <div className="flex items-center gap-3">
                          {/* Reorder buttons */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => moveNavLink(idx, -1)}
                              disabled={idx === 0}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                              title="Move up"
                            >
                              ▲
                            </button>
                            <button
                              onClick={() => moveNavLink(idx, 1)}
                              disabled={idx === navLinks.length - 1}
                              className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                              title="Move down"
                            >
                              ▼
                            </button>
                          </div>

                          {/* Label */}
                          <div className="flex-1">
                            <label className="block text-xs text-muted-foreground mb-1">
                              Label
                            </label>
                            <input
                              type="text"
                              value={link.label}
                              onChange={(e) =>
                                updateNavLink(link.id, "label", e.target.value)
                              }
                              placeholder="Link text"
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>

                          {/* Href */}
                          <div className="flex-1">
                            <label className="block text-xs text-muted-foreground mb-1">
                              URL
                            </label>
                            <input
                              type="text"
                              value={link.href}
                              onChange={(e) =>
                                updateNavLink(link.id, "href", e.target.value)
                              }
                              placeholder="/path or https://..."
                              className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                          </div>
                        </div>

                        {/* Row 2: visible + edit page + delete */}
                        <div className="flex items-center gap-4 pl-7">
                          {/* Visible toggle */}
                          <label className="inline-flex items-center gap-2 cursor-pointer text-sm">
                            <input
                              type="checkbox"
                              checked={link.isVisible}
                              onChange={(e) =>
                                updateNavLink(link.id, "isVisible", e.target.checked)
                              }
                              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                            />
                            {link.isVisible ? (
                              <Eye className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span className="text-muted-foreground">
                              {link.isVisible ? "Visible" : "Hidden"}
                            </span>
                          </label>

                          {/* Edit Page link (for internal pages) */}
                          {getEditUrl(link.href) && (
                            <a
                              href={getEditUrl(link.href)!}
                              className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 hover:underline"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit Page
                            </a>
                          )}

                          {/* Delete */}
                          <div className="ml-auto">
                            <button
                              onClick={() => removeNavLink(link.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete link"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add link button */}
                  <button
                    onClick={addNavLink}
                    className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:border-brand-400 hover:text-brand-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add Link
                  </button>
                </>
              )}
            </div>
          ) : (
            /* ===== Settings Tabs (General / Homepage / Pages) ===== */
            <div className="space-y-8">
              {currentTab.groups.map((grp) => {
                const settings = grouped[grp];
                if (!settings || settings.length === 0) return null;

                const showSubHeading = currentTab.groups.length > 1;

                return (
                  <div key={grp} className="space-y-4">
                    {showSubHeading && (
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                        {subGroupLabels[grp] || grp}
                      </h3>
                    )}
                    {settings.map(renderSettingField)}
                  </div>
                );
              })}

              {currentTab.groups.every(
                (grp) => !grouped[grp] || grouped[grp].length === 0
              ) && (
                <p className="text-muted-foreground text-sm">
                  No settings found for this section. Run the database seed to
                  populate defaults.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
