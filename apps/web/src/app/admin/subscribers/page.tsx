"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Search,
  Trash2,
  RefreshCw,
  Download,
  CheckCircle,
  Clock,
  Users,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";

interface Subscriber {
  id: string;
  email: string;
  verified: boolean;
  notifyMode: string;
  subscribedAt: string | null;
  createdAt: string;
}

interface SubscribersData {
  subscribers: Subscriber[];
  stats: { total: number; verified: number; unverified: number };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export default function AdminSubscribersPage() {
  const [data, setData] = useState<SubscribersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubscribers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: page.toString(),
      filter,
      ...(search && { search }),
    });
    const res = await fetch(`/api/admin/subscribers?${params}`);
    if (res.ok) {
      setData(await res.json());
    }
    setLoading(false);
  }, [page, filter, search]);

  useEffect(() => {
    fetchSubscribers();
  }, [fetchSubscribers]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (!data) return;
    if (selected.size === data.subscribers.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(data.subscribers.map((s) => s.id)));
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this subscriber?")) return;
    setActionLoading(id);
    const res = await fetch(`/api/admin/subscribers/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Subscriber deleted");
      fetchSubscribers();
    } else {
      toast.error("Failed to delete");
    }
    setActionLoading(null);
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} subscriber(s)?`)) return;
    setActionLoading("bulk");
    const res = await fetch("/api/admin/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    if (res.ok) {
      toast.success(`Deleted ${selected.size} subscriber(s)`);
      setSelected(new Set());
      fetchSubscribers();
    } else {
      toast.error("Failed to delete");
    }
    setActionLoading(null);
  }

  async function handleResend(id: string) {
    setActionLoading(id);
    const res = await fetch(`/api/admin/subscribers/${id}`, {
      method: "POST",
    });
    if (res.ok) {
      toast.success("Verification email resent");
    } else {
      const err = await res.json();
      toast.error(err.error || "Failed to resend");
    }
    setActionLoading(null);
  }

  function handleExport() {
    window.open("/api/admin/subscribers/export", "_blank");
  }

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-muted rounded-xl"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded-xl"></div>
        </div>
      </div>
    );
  }

  const stats = data?.stats || { total: 0, verified: 0, unverified: 0 };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscribers</h1>
          <p className="text-sm text-muted-foreground">
            Manage email subscribers
          </p>
        </div>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent transition-colors"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-5 w-5 text-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Total
            </span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Verified
            </span>
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {stats.verified}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Unverified
            </span>
          </div>
          <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
            {stats.unverified}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {["all", "verified", "unverified"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
              className={`px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "text-muted-foreground hover:bg-accent"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/40"
          />
        </div>
        {selected.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={actionLoading === "bulk"}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 transition-colors"
          >
            {actionLoading === "bulk" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete ({selected.size})
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={
                    data !== null &&
                    data.subscribers.length > 0 &&
                    selected.size === data.subscribers.length
                  }
                  onChange={toggleSelectAll}
                  className="accent-brand-600"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                Mode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">
                Date
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {data?.subscribers.map((sub) => (
              <tr
                key={sub.id}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(sub.id)}
                    onChange={() => toggleSelect(sub.id)}
                    className="accent-brand-600"
                  />
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground">{sub.email}</span>
                </td>
                <td className="px-4 py-3">
                  {sub.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
                      <CheckCircle className="h-3 w-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:text-yellow-400">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground capitalize">
                    {sub.notifyMode.toLowerCase()}
                  </span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <span className="text-xs text-muted-foreground">
                    {formatDate(sub.subscribedAt || sub.createdAt)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {!sub.verified && (
                      <button
                        onClick={() => handleResend(sub.id)}
                        disabled={actionLoading === sub.id}
                        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Resend verification"
                      >
                        {actionLoading === sub.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(sub.id)}
                      disabled={actionLoading === sub.id}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Delete subscriber"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {data?.subscribers.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  <Mail className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  <p>No subscribers found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.totalPages} ({data.pagination.total} total)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() =>
                setPage((p) => Math.min(data.pagination.totalPages, p + 1))
              }
              disabled={page === data.pagination.totalPages}
              className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
