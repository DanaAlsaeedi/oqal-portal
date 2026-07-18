"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useLang } from "@/app/providers";

interface Debtor {
  id: string;
  clientName: string;
  phoneNumber: string;
  referenceId: string | null;
  debtValueSar: number;
  status: string;
  callOutcome: string | null;
  callSummary: string | null;
  ptpAmount: number | null;
  ptpDate: string | null;
  payProbability: number | null;
  sentiment: string | null;
  attempts: number;
  lastCallAt: string | null;
}

interface BatchDetail {
  id: string;
  name: string;
  status: string;
  totalDebtors: number;
  processedCount: number;
  originalFileName: string | null;
  createdAt: string;
  debtors: Debtor[];
}

export default function BatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLang();
  const [batch, setBatch] = useState<BatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBatch = useCallback(() => {
    fetch(`/api/batch/${id}`)
      .then((r) => r.json())
      .then((d) => { setBatch(d.batch); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchBatch();
  }, [fetchBatch]);

  // Live polling when running
  useEffect(() => {
    if (!batch || batch.status !== "running") return;
    const interval = setInterval(fetchBatch, 5000);
    return () => clearInterval(interval);
  }, [batch?.status, fetchBatch]);

  const handleAction = async (action: "start" | "pause") => {
    setActionLoading(true);
    await fetch(`/api/batch/${id}/${action}`, { method: "POST" });
    await new Promise((r) => setTimeout(r, 500));
    fetchBatch();
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!batch) {
    return <div className="text-center py-12 text-text-3">Batch not found</div>;
  }

  const debtors = batch.debtors || [];
  const totalDebt = debtors.reduce((s, d) => s + d.debtValueSar, 0);
  const totalPromised = debtors.reduce((s, d) => s + (d.ptpAmount || 0), 0);
  const pctDone = batch.totalDebtors ? Math.round((batch.processedCount / batch.totalDebtors) * 100) : 0;

  const statusIcon: Record<string, string> = {
    pending: "⏳",
    calling: "📞",
    completed: "✅",
    no_answer: "📵",
    failed: "❌",
    skipped: "⏭️",
    paused: "⏸️",
  };

  const outcomeColor: Record<string, string> = {
    ptp: "bg-green-light text-green",
    no_commitment: "bg-text-3/10 text-text-2",
    callback: "bg-accent-light text-accent",
    dispute: "bg-red-light text-red",
    refused: "bg-red-light text-red",
  };

  const batchStatusColor: Record<string, string> = {
    ready: "bg-accent-light text-accent",
    running: "bg-green-light text-green",
    paused: "bg-amber-light text-amber",
    completed: "bg-green-light text-green",
    failed: "bg-red-light text-red",
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text-1">{batch.name}</h1>
          <p className="text-sm text-text-3 mt-0.5">
            {batch.originalFileName} · {new Date(batch.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${batchStatusColor[batch.status] || "bg-text-3/10 text-text-2"}`}>
            {t(("status_" + batch.status) as Parameters<typeof t>[0])}
          </span>
          {(batch.status === "ready" || batch.status === "paused") && (
            <button
              onClick={() => handleAction("start")}
              disabled={actionLoading}
              className="px-4 py-2 bg-green hover:opacity-90 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {batch.status === "paused" ? t("resumeCollection") : t("startCollection")}
            </button>
          )}
          {batch.status === "running" && (
            <button
              onClick={() => handleAction("pause")}
              disabled={actionLoading}
              className="px-4 py-2 bg-amber hover:opacity-90 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {t("pauseCollection")}
            </button>
          )}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-3">{t("progress")}</div>
          <div className="text-2xl font-bold tabular-nums text-accent mt-1">{pctDone}%</div>
          <div className="mt-2 h-1.5 bg-surface-alt rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: `${pctDone}%` }} />
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-3">{t("debtors")}</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{batch.processedCount}<span className="text-text-3 text-base">/{batch.totalDebtors}</span></div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-3">{t("totalDebt")}</div>
          <div className="text-2xl font-bold tabular-nums mt-1">{totalDebt.toLocaleString()} <span className="text-sm text-text-3">SAR</span></div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-text-3">{t("totalPromised")}</div>
          <div className="text-2xl font-bold tabular-nums text-green mt-1">{totalPromised.toLocaleString()} <span className="text-sm">SAR</span></div>
        </div>
      </div>

      {/* Live indicator */}
      {batch.status === "running" && (
        <div className="bg-green-light border border-green/20 rounded-lg px-4 py-2.5 mb-4 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
          <span className="text-sm text-green font-medium">Live — auto-refreshing every 5 seconds</span>
        </div>
      )}

      {/* Debtor table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-wide text-text-3 bg-surface-alt">
                <th className="px-4 py-3 text-start">{t("field_clientName")}</th>
                <th className="px-4 py-3 text-start">{t("field_phoneNumber")}</th>
                <th className="px-4 py-3 text-start">{t("field_referenceId")}</th>
                <th className="px-4 py-3 text-start">{t("field_debtValueSar")}</th>
                <th className="px-4 py-3 text-start">{t("batchStatus")}</th>
                <th className="px-4 py-3 text-start">Outcome</th>
                <th className="px-4 py-3 text-end">PTP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {debtors.map((d) => (
                <tr key={d.id} className={`transition-colors ${d.status === "calling" ? "bg-accent-light animate-pulse" : "hover:bg-surface-alt"}`}>
                  <td className="px-4 py-3 font-medium text-text-1">{d.clientName}</td>
                  <td className="px-4 py-3 text-text-2 tabular-nums" dir="ltr">{d.phoneNumber}</td>
                  <td className="px-4 py-3 text-text-3">{d.referenceId || "—"}</td>
                  <td className="px-4 py-3 tabular-nums">{d.debtValueSar.toLocaleString()} SAR</td>
                  <td className="px-4 py-3">
                    <span className="text-sm">
                      {statusIcon[d.status] || "⏳"} {t(("debtor_" + d.status) as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.callOutcome ? (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${outcomeColor[d.callOutcome] || ""}`}>
                        {t(("outcome_" + d.callOutcome) as Parameters<typeof t>[0])}
                      </span>
                    ) : (
                      <span className="text-text-3">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {d.ptpAmount ? (
                      <span className="font-semibold text-green">{d.ptpAmount.toLocaleString()} SAR</span>
                    ) : (
                      <span className="text-text-3">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
