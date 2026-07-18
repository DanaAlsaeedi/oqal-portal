"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useLang } from "@/app/providers";
import type { SessionUser } from "@/lib/types";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { t, lang, setLang } = useLang();
  const user = session?.user as SessionUser | undefined;
  const isAdmin = user?.role === "admin";

  const navItems = [
    { href: "/dashboard", label: t("dashboard"), icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { href: "/dashboard/upload", label: t("upload"), icon: "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" },
    { href: "/dashboard/batches", label: t("batches"), icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  ];

  if (isAdmin) {
    navItems.push({
      href: "/admin",
      label: t("admin"),
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z",
    });
  }

  return (
    <aside className="w-64 bg-surface border-e border-border flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 flex items-center justify-center">
            <svg className="w-7 h-7 text-accent" viewBox="-12 -12 124 124" fill="none">
              <path stroke="currentColor" strokeWidth="9" strokeLinejoin="round" d="M94 50 L63 19 L15 31 L15 69 L63 81 Z"/>
              <g fill="currentColor"><circle cx="94" cy="50" r="8"/><circle cx="63" cy="19" r="8"/><circle cx="15" cy="31" r="8"/><circle cx="15" cy="69" r="8"/><circle cx="63" cy="81" r="8"/></g>
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm text-text-1" style={{ fontFamily: "'Space Mono', monospace", letterSpacing: "0.04em" }}>AQAL<span className="text-accent">AI</span></div>
            <div className="text-xs text-text-3">{user?.company || user?.name}</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-accent-light text-accent font-medium"
                  : "text-text-2 hover:bg-surface-alt hover:text-text-1"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-2">
        <button
          onClick={() => setLang(lang === "en" ? "ar" : "en")}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-text-2 hover:bg-surface-alt transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
          </svg>
          {lang === "en" ? "العربية" : "English"}
        </button>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-red hover:bg-red-light transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          {t("signOut")}
        </button>
      </div>
    </aside>
  );
}
