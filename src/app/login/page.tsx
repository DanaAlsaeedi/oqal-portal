"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/app/providers";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t, lang, setLang } = useLang();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError(t("invalidCredentials"));
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ground p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 flex items-center justify-center mx-auto mb-4">
            <svg className="w-12 h-12 text-accent" viewBox="-12 -12 124 124" fill="none">
              <path stroke="currentColor" strokeWidth="6.5" strokeLinejoin="round" d="M94 50 L63 19 L15 31 L15 69 L63 81 Z"/>
              <g fill="currentColor"><circle cx="94" cy="50" r="5.5"/><circle cx="63" cy="19" r="5.5"/><circle cx="15" cy="31" r="5.5"/><circle cx="15" cy="69" r="5.5"/><circle cx="63" cy="81" r="5.5"/></g>
            </svg>
          </div>
          <h1 className="text-xl font-bold text-text-1" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.04em" }}>AQAL<span className="text-accent">AI</span></h1>
          <p className="text-sm text-text-2 mt-1">{t("login")}</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 space-y-4">
          {error && (
            <div className="bg-red-light text-red text-sm px-4 py-2.5 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">{t("email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-lg text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              placeholder="client@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-2 mb-1.5">{t("password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-alt border border-border rounded-lg text-sm text-text-1 placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading ? "..." : t("signIn")}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            className="text-sm text-text-3 hover:text-text-2 transition"
          >
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>
      </div>
    </div>
  );
}
