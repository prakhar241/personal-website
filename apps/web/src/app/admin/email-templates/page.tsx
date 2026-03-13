"use client";

import { useState, useEffect, useRef } from "react";
import {
  FileText,
  Save,
  Eye,
  RotateCcw,
  X,
  Loader2,
  CheckCircle,
  Info,
} from "lucide-react";
import toast from "react-hot-toast";

interface EmailTemplate {
  id: string;
  templateKey: string;
  subject: string;
  htmlBody: string;
  isActive: boolean;
}

const TEMPLATE_LABELS: Record<string, string> = {
  verification: "Verification Email",
  welcome: "Welcome Email",
  new_post: "New Post Notification",
  rss_digest: "Weekly Digest",
};

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [variables, setVariables] = useState<Record<string, string[]>>({});
  const [defaults, setDefaults] = useState<EmailTemplate[]>([]);
  const [activeKey, setActiveKey] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    async function fetchTemplates() {
      setLoading(true);
      const res = await fetch("/api/admin/email-templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates);
        setDefaults(structuredClone(data.templates));
        setVariables(data.variables);
        if (data.templates.length > 0 && !activeKey) {
          setActiveKey(data.templates[0].templateKey);
        }
      }
      setLoading(false);
    }
    fetchTemplates();
  }, []);

  const activeTemplate = templates.find((t) => t.templateKey === activeKey);
  const activeVars = variables[activeKey] || [];
  const hasChanges = Object.values(changes).some(Boolean);

  function updateTemplate(key: string, field: "subject" | "htmlBody", value: string) {
    setTemplates((prev) =>
      prev.map((t) => (t.templateKey === key ? { ...t, [field]: value } : t))
    );
    const original = defaults.find((t) => t.templateKey === key);
    const current = templates.find((t) => t.templateKey === key);
    if (original && current) {
      const updatedCurrent = { ...current, [field]: value };
      const isDirty =
        updatedCurrent.subject !== original.subject ||
        updatedCurrent.htmlBody !== original.htmlBody;
      setChanges((prev) => ({ ...prev, [key]: isDirty }));
    }
  }

  async function handleSave() {
    setSaving(true);
    const changedTemplates = templates.filter((t) => changes[t.templateKey]);
    try {
      const res = await fetch("/api/admin/email-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templates: changedTemplates.map((t) => ({
            templateKey: t.templateKey,
            subject: t.subject,
            htmlBody: t.htmlBody,
          })),
        }),
      });
      if (res.ok) {
        toast.success("Templates saved");
        setDefaults(structuredClone(templates));
        setChanges({});
      } else {
        toast.error("Failed to save");
      }
    } catch {
      toast.error("Network error");
    }
    setSaving(false);
  }

  async function handlePreview() {
    if (!activeTemplate) return;
    const res = await fetch("/api/admin/email-templates/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateKey: activeTemplate.templateKey,
        subject: activeTemplate.subject,
        htmlBody: activeTemplate.htmlBody,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
    }
  }

  function handleReset() {
    if (!activeKey) return;
    const original = defaults.find((t) => t.templateKey === activeKey);
    if (original) {
      setTemplates((prev) =>
        prev.map((t) =>
          t.templateKey === activeKey
            ? { ...t, subject: original.subject, htmlBody: original.htmlBody }
            : t
        )
      );
      setChanges((prev) => ({ ...prev, [activeKey]: false }));
      toast.success("Template reset to saved version");
    }
  }

  // Write preview HTML into iframe
  useEffect(() => {
    if (previewHtml && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(previewHtml);
        doc.close();
      }
    }
  }, [previewHtml]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-96 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Email Templates
          </h1>
          <p className="text-sm text-muted-foreground">
            Customize the emails sent to subscribers
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save Changes
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar - template tabs */}
        <div className="w-56 shrink-0 space-y-1">
          {templates.map((t) => (
            <button
              key={t.templateKey}
              onClick={() => setActiveKey(t.templateKey)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                activeKey === t.templateKey
                  ? "bg-brand-600/10 text-brand-600"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {TEMPLATE_LABELS[t.templateKey] || t.templateKey}
              </span>
              {changes[t.templateKey] && (
                <span className="ml-auto h-2 w-2 rounded-full bg-brand-500 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Editor */}
        {activeTemplate && (
          <div className="flex-1 space-y-5">
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Subject Line
              </label>
              <input
                type="text"
                value={activeTemplate.subject}
                onChange={(e) =>
                  updateTemplate(activeKey, "subject", e.target.value)
                }
                className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500"
              />
            </div>

            {/* HTML Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">
                  HTML Body
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={handlePreview}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <Eye className="h-3 w-3" />
                    Preview
                  </button>
                  <button
                    onClick={handleReset}
                    className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>
              </div>
              <textarea
                value={activeTemplate.htmlBody}
                onChange={(e) =>
                  updateTemplate(activeKey, "htmlBody", e.target.value)
                }
                rows={18}
                className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:border-brand-500 resize-y"
                spellCheck={false}
              />
            </div>

            {/* Available variables */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  Available Variables
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeVars.map((v) => (
                  <code
                    key={v}
                    className="rounded bg-background border border-border px-2 py-0.5 text-xs font-mono text-brand-600 cursor-pointer hover:bg-brand-600/10 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(`{{${v}}}`);
                      toast.success(`Copied {{${v}}}`);
                    }}
                    title="Click to copy"
                  >
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewHtml && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden border border-border shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground">Preview</p>
                <p className="text-sm font-medium text-foreground">
                  {previewSubject}
                </p>
              </div>
              <button
                onClick={() => setPreviewHtml(null)}
                className="rounded-md p-1.5 hover:bg-accent transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe
                ref={iframeRef}
                title="Email Preview"
                className="w-full h-full min-h-[400px] border-0"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
