"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/app/providers";

interface Client {
  id: string;
  email: string;
  name: string;
  role: string;
  company: string | null;
  createdAt: string;
  _count: { batches: number };
}

export default function AdminPage() {
  const { t } = useLang();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", company: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchClients = () => {
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((d) => { setClients(d.clients || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchClients(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const res = await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || t("genericError"));
      setSaving(false);
      return;
    }

    setForm({ name: "", email: "", password: "", company: "" });
    setShowForm(false);
    setSaving(false);
    fetchClients();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await fetch("/api/admin/clients", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    fetchClients();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-text-1">{t("clients")}</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition"
        >
          + {t("createClient")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-surface border border-border rounded-xl p-5 mb-6 space-y-4">
          {error && <div className="bg-red-light text-red text-sm px-3 py-2 rounded-lg">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-2 mb-1">{t("clientName")}</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-2 mb-1">{t("clientEmail")}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-2 mb-1">{t("clientPassword")}</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
                required
                minLength={6}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-2 mb-1">{t("clientCompany")}</label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                className="w-full px-3 py-2 bg-surface-alt border border-border rounded-lg text-sm text-text-1 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-border text-text-2 rounded-lg text-sm hover:bg-surface-alt transition">
              {t("cancel")}
            </button>
            <button type="submit" disabled={saving} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
              {saving ? "..." : t("save")}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center text-text-3 text-sm">{t("noClients")}</div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold uppercase tracking-wide text-text-3 bg-surface-alt">
                  <th className="px-5 py-3 text-start">{t("clientName")}</th>
                  <th className="px-5 py-3 text-start">{t("clientEmail")}</th>
                  <th className="px-5 py-3 text-start">{t("clientCompany")}</th>
                  <th className="px-5 py-3 text-start">{t("role")}</th>
                  <th className="px-5 py-3 text-start">{t("totalBatches")}</th>
                  <th className="px-5 py-3 text-start">{t("actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {clients.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-alt transition-colors">
                    <td className="px-5 py-3.5 font-medium text-text-1">{c.name}</td>
                    <td className="px-5 py-3.5 text-text-2">{c.email}</td>
                    <td className="px-5 py-3.5 text-text-2">{c.company || "—"}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${c.role === "admin" ? "bg-accent-light text-accent" : "bg-text-3/10 text-text-2"}`}>
                        {c.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums text-text-2">{c._count.batches}</td>
                    <td className="px-5 py-3.5">
                      {c.role !== "admin" && (
                        <button onClick={() => handleDelete(c.id)} className="text-red hover:text-red/80 text-sm font-medium transition">
                          {t("delete")}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
