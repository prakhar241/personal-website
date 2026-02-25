"use client";

import { useState, useEffect } from "react";
import { 
  Navigation, 
  Plus, 
  Save, 
  Loader2, 
  GripVertical, 
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Lock
} from "lucide-react";
import toast from "react-hot-toast";

interface NavLink {
  id: string;
  label: string;
  href: string;
  sortOrder: number;
  isVisible: boolean;
  isSystem: boolean;
  openInNewTab: boolean;
}

export default function AdminNavigationPage() {
  const [links, setLinks] = useState<NavLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchLinks();
  }, []);

  async function fetchLinks() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/navigation");
      if (res.ok) {
        const data = await res.json();
        setLinks(data.links || []);
      }
    } catch (error) {
      toast.error("Failed to load navigation links");
    }
    setLoading(false);
  }

  function updateLink(id: string, field: keyof NavLink, value: string | number | boolean) {
    setLinks(prev => prev.map(link => 
      link.id === id ? { ...link, [field]: value } : link
    ));
    setHasChanges(true);
  }

  function addNewLink() {
    const newLink: NavLink = {
      id: `new-${Date.now()}`,
      label: "New Link",
      href: "/",
      sortOrder: Math.max(...links.map(l => l.sortOrder), 0) + 10,
      isVisible: true,
      isSystem: false,
      openInNewTab: false,
    };
    setLinks(prev => [...prev, newLink]);
    setHasChanges(true);
  }

  function removeLink(id: string) {
    const link = links.find(l => l.id === id);
    if (link?.isSystem) {
      toast.error("System links cannot be deleted");
      return;
    }
    setLinks(prev => prev.filter(l => l.id !== id));
    setHasChanges(true);
  }

  function moveLink(index: number, direction: "up" | "down") {
    const newLinks = [...links];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newLinks.length) return;
    
    // Swap sort orders
    const tempOrder = newLinks[index].sortOrder;
    newLinks[index].sortOrder = newLinks[targetIndex].sortOrder;
    newLinks[targetIndex].sortOrder = tempOrder;
    
    // Sort by new order
    newLinks.sort((a, b) => a.sortOrder - b.sortOrder);
    setLinks(newLinks);
    setHasChanges(true);
  }

  async function handleSave() {
    if (!hasChanges) {
      toast("No changes to save");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/navigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ links }),
      });

      if (res.ok) {
        toast.success("Navigation saved!");
        setHasChanges(false);
        fetchLinks(); // Refresh to get correct IDs for new links
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      }
    } catch (error) {
      toast.error("Failed to save navigation");
    }
    setSaving(false);
  }

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
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Navigation className="h-6 w-6 text-brand-600" />
            Navigation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage header navigation links, labels, and ordering
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addNewLink}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Link
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Links Table */}
      <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-10">
                Order
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Label
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                URL Path
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider w-24">
                Sort #
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                Visible
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                New Tab
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-20">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {links.sort((a, b) => a.sortOrder - b.sortOrder).map((link, index) => (
              <tr key={link.id} className="hover:bg-muted/30 transition-colors">
                {/* Reorder */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => moveLink(index, "up")}
                      disabled={index === 0}
                      className="p-1 hover:bg-accent rounded disabled:opacity-30"
                      title="Move up"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      onClick={() => moveLink(index, "down")}
                      disabled={index === links.length - 1}
                      className="p-1 hover:bg-accent rounded disabled:opacity-30"
                      title="Move down"
                    >
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>
                </td>

                {/* Label */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {link.isSystem && (
                      <span title="System link">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      </span>
                    )}
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateLink(link.id, "label", e.target.value)}
                      className="w-full px-2 py-1 bg-background border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      placeholder="Link label"
                    />
                  </div>
                </td>

                {/* URL */}
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={link.href}
                    onChange={(e) => updateLink(link.id, "href", e.target.value)}
                    disabled={link.isSystem}
                    className="w-full px-2 py-1 bg-background border rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    placeholder="/path"
                  />
                </td>

                {/* Sort Order */}
                <td className="px-4 py-3">
                  <input
                    type="number"
                    value={link.sortOrder}
                    onChange={(e) => updateLink(link.id, "sortOrder", parseInt(e.target.value) || 0)}
                    className="w-20 px-2 py-1 bg-background border rounded text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </td>

                {/* Visible Toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => updateLink(link.id, "isVisible", !link.isVisible)}
                    className={`p-2 rounded-lg transition-colors ${
                      link.isVisible 
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={link.isVisible ? "Visible" : "Hidden"}
                  >
                    {link.isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                </td>

                {/* New Tab Toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => updateLink(link.id, "openInNewTab", !link.openInNewTab)}
                    className={`p-2 rounded-lg transition-colors ${
                      link.openInNewTab 
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" 
                        : "bg-muted text-muted-foreground"
                    }`}
                    title={link.openInNewTab ? "Opens in new tab" : "Opens in same tab"}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </td>

                {/* Delete */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => removeLink(link.id)}
                    disabled={link.isSystem}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={link.isSystem ? "System links cannot be deleted" : "Delete link"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {links.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No navigation links yet. Click "Add Link" to create one.
          </div>
        )}
      </div>

      {/* Help Text */}
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
        <h3 className="font-medium text-foreground mb-2">Tips:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Sort #</strong>: Lower numbers appear first in the navigation</li>
          <li><strong>System links</strong> (marked with 🔒) cannot be deleted but can be renamed or hidden</li>
          <li><strong>New Tab</strong>: Enable for external links to open in a new browser tab</li>
          <li>Changes are saved only when you click "Save Changes"</li>
        </ul>
      </div>
    </div>
  );
}
