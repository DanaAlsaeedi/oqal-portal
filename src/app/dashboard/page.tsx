"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/app/providers";

interface BatchSummary {
  id: string;
  name: string;
  status: string;
  totalDebtors: number;
  processedCount: number;
  createdAt: string;
  user: { name: string; company: string | null };
}

export default function DashboardPage() {
  const { t } = useLang();
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/batch")
      .then((r) => r.json())
      .then((data) => {
        setBatches(data.batches || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const active = batches.filter((b) => b.status === "running" || b.status === "paused").length;
  const total = batches.length;
  const totalDebtors = batches.reduce((s, b) => s + b.totalDebtors, 0);
  const processed = batches.reduce((s, b) => s + b.processedCount, 0);

  const statusColor: Record<string, string> = {
    pending: "bg-text-3/10 text-text-2",
    ready: "bg-accent-light text-accent",
    running: "bg-green-light text-green",
    paused: "bg-amber-light text-amber",
    completed: "bg-green-light text-green",
    failed: "bg-red-light text-red",
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-text-1">{t("dashboard")}</h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: t("totalBatches"), value: total, color: "" },
          { label: t("activeBatches"), value: active, color: active > 0 ? "text-green" : "" },
          { label: t("debtors"), value: totalDebtors, color: "" },
          { label: t("progress"), value: totalDebtors ? `${Math.round((processed / totalDebtors) * 100)}%` : "0%", color: "text-accent" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-xl p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-text-3 mb-1">{kpi.label}</div>
            <div className={`text-2xl font-bold tabular-nums ${kpi.color}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-border rounded-xl">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-2">{t("recentBatches")}</h2>
          <Link
            href="/dashboard/upload"
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition"
          >
            + {t("upload")}
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-3">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center text-text-3 text-sm">{t("noBatches")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-text-3 bg-surface-alt">
                  <th className="px-5 py-3 text-start">{t("batchName")}</th>
                  <th className="px-5 py-3 text-start">{t("batchStatus")}</th>
                  <th className="px-5 py-3 text-start">{t("debtors")}</th>
                  <th className="px-5 py-3 text-start">{t("progress")}</th>
                  <th className="px-5 py-3 text-start"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((b) => (
                  <tr key={b.id} className="hover:bg-surface-alt transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-text-1">{b.name}</div>
                      <div className="text-xs text-text-3">{new Date(b.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[b.status] || "bg-text-3/10 text-text-2"}`}>
                        {t(("status_" + b.status) as Parameters<typeof t>[0])}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-text-2">{b.totalDebtors}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-surface-alt rounded-full overflow-hidden max-w-20">
                          <div
                            className="h-full bg-accent rounded-full transition-all"
                            style={{ width: `${b.totalDebtors ? (b.processedCount / b.totalDebtors) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-text-3 tabular-nums">{b.processedCount}/{b.totalDebtors}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Link href={`/dashboard/batch/${b.id}`} className="text-accent hover:text-accent-hover text-sm font-medium">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
