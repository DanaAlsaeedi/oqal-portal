"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/app/providers";

interface Batch {
  id: string;
  name: string;
  status: string;
  totalDebtors: number;
  processedCount: number;
  originalFileName: string | null;
  createdAt: string;
}

export default function BatchesPage() {
  const { t } = useLang();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/batch")
      .then((r) => r.json())
      .then((d) => { setBatches(d.batches || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-1">{t("batches")}</h1>
        <Link href="/dashboard/upload" className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition">
          + {t("upload")}
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : batches.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-3 text-sm">{t("noBatches")}</div>
      ) : (
        <div className="grid gap-4">
          {batches.map((b) => (
            <Link key={b.id} href={`/dashboard/batch/${b.id}`} className="bg-surface border border-border rounded-xl p-5 hover:border-accent/30 transition-colors block">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-text-1">{b.name}</h3>
                  <p className="text-xs text-text-3 mt-0.5">
                    {b.originalFileName} · {new Date(b.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor[b.status] || ""}`}>
                  {t(("status_" + b.status) as Parameters<typeof t>[0])}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-4">
                <div className="flex-1 h-2 bg-surface-alt rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${b.totalDebtors ? (b.processedCount / b.totalDebtors) * 100 : 0}%` }} />
                </div>
                <span className="text-xs text-text-3 tabular-nums">{b.processedCount}/{b.totalDebtors}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
