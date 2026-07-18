"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/app/providers";
import type { ColumnMapping, DebtorField } from "@/lib/types";
import { ALL_FIELDS, FIELD_LABELS, REQUIRED_FIELDS } from "@/lib/types";

type Step = "upload" | "analyzing" | "mapping" | "creating";

export default function UploadPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [totalRows, setTotalRows] = useState(0);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [batchName, setBatchName] = useState("");
  const [error, setError] = useState("");

  const handleFile = async (f: File) => {
    setFile(f);
    setFileName(f.name);
    setError("");
    setStep("analyzing");

    const formData = new FormData();
    formData.append("file", f);

    try {
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { headers, sampleRows, totalRows: rows } = await uploadRes.json();
      setTotalRows(rows);

      const mapRes = await fetch("/api/map-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headers, sampleRows }),
      });
      if (!mapRes.ok) throw new Error("Mapping failed");
      const { mappings: aiMappings } = await mapRes.json();

      setMappings(aiMappings);
      setBatchName(f.name.replace(/\.xlsx?$/i, ""));
      setStep("mapping");
    } catch {
      setError(t("uploadError"));
      setStep("upload");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".xlsx")) handleFile(f);
  };

  const updateMapping = (index: number, targetField: string | null) => {
    setMappings((prev) =>
      prev.map((m, i) => (i === index ? { ...m, targetField } : m))
    );
  };

  const missingRequired = REQUIRED_FIELDS.filter(
    (f) => !mappings.some((m) => m.targetField === f)
  );

  const handleConfirm = async () => {
    if (!file || !batchName.trim() || missingRequired.length > 0) return;
    setStep("creating");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", batchName.trim());
    formData.append("mappings", JSON.stringify(mappings));

    try {
      const res = await fetch("/api/batch", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Create failed");
      const { batch } = await res.json();
      router.push(`/dashboard/batch/${batch.id}`);
    } catch {
      setError(t("genericError"));
      setStep("mapping");
    }
  };

  const usedFields = mappings.map((m) => m.targetField).filter(Boolean);

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-text-1">{t("uploadTitle")}</h1>
        <p className="text-sm text-text-2 mt-1">{t("uploadDesc")}</p>
      </div>

      {error && (
        <div className="bg-red-light text-red text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      {step === "upload" && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="bg-surface border-2 border-dashed border-border hover:border-accent/40 rounded-xl p-12 text-center cursor-pointer transition-colors"
        >
          <svg className="w-12 h-12 mx-auto text-text-3 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-text-1 font-medium">{t("dropFile")}</p>
          <p className="text-sm text-text-3 mt-1">{t("orClickUpload")}</p>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
        </div>
      )}

      {step === "analyzing" && (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-text-1 font-medium">{t("analyzing")}</p>
          <p className="text-sm text-text-3 mt-1">{fileName}</p>
        </div>
      )}

      {(step === "mapping" || step === "creating") && (
        <div className="space-y-5">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-text-1">{t("mappingTitle")}</h2>
                <p className="text-xs text-text-3 mt-0.5">{t("mappingDesc")}</p>
              </div>
              <span className="text-xs text-text-3 tabular-nums">{totalRows} rows</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs font-semibold uppercase tracking-wide text-text-3">
                    <th className="px-3 py-2 text-start">{t("yourColumn")}</th>
                    <th className="px-3 py-2 text-start">{t("mapsTo")}</th>
                    <th className="px-3 py-2 text-start">{t("sampleData")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {mappings.map((m, i) => (
                    <tr key={m.sourceColumn} className="hover:bg-surface-alt">
                      <td className="px-3 py-2.5">
                        <span className="font-medium text-text-1">{m.sourceColumn}</span>
                        {m.confidence >= 0.8 && m.targetField && (
                          <span className="ms-2 text-xs text-green">✓ {Math.round(m.confidence * 100)}%</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <select
                          value={m.targetField || ""}
                          onChange={(e) => updateMapping(i, e.target.value || null)}
                          className="w-full px-2 py-1.5 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
                        >
                          <option value="">{t("unmapped")}</option>
                          {ALL_FIELDS.map((f) => (
                            <option
                              key={f}
                              value={f}
                              disabled={usedFields.includes(f) && m.targetField !== f}
                            >
                              {FIELD_LABELS[f as DebtorField][lang]}
                              {REQUIRED_FIELDS.includes(f as (typeof REQUIRED_FIELDS)[number]) ? " *" : ""}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 text-text-3 text-xs max-w-48 truncate">
                        {m.sampleValues?.slice(0, 2).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingRequired.length > 0 && (
              <div className="mt-3 bg-amber-light text-amber text-xs px-3 py-2 rounded-lg">
                Missing required: {missingRequired.map((f) => FIELD_LABELS[f][lang]).join(", ")}
              </div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-xl p-5">
            <label className="block text-sm font-medium text-text-2 mb-1.5">{t("batchName")}</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder={t("batchNamePlaceholder")}
              className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-lg text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep("upload"); setMappings([]); setFile(null); }}
              className="px-5 py-2.5 border border-border text-text-2 rounded-lg text-sm font-medium hover:bg-surface-alt transition"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleConfirm}
              disabled={step === "creating" || missingRequired.length > 0 || !batchName.trim()}
              className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
            >
              {step === "creating" ? "..." : t("confirm")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
