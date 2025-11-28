// src/app/(protected)/layout.tsx
import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAuthPayloadFromCookies } from "@/lib/auth";

const navItems = [
  { href: "/", label: "Дашборд" },
  { href: "/punishments", label: "Наказания" },
  { href: "/profile", label: "Профиль" },
  { href: "/admin-stats", label: "Статистика", superadmin: true },
  { href: "/settings", label: "Настройки", superadmin: true },
];

function initials(username: string) {
  if (!username) return "U";
  return username[0]?.toUpperCase() ?? "U";
}

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const payload = await getAuthPayloadFromCookies();

  const role = payload?.role ?? "ADMIN";
  const username = payload?.username ?? "admin";
  const avatarUrl = payload?.avatarUrl ?? null; // 👈 берем аву из payload

  return (
    <div className="relative min-h-screen text-slate-100 flex bg-transparent">
      {/* затемнение + лёгкий блюр всего фона */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/35 backdrop-blur-[3px]" />

      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col justify-between border-r border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-8">
            {/* кружок слева */}
            <div className="h-9 w-9 rounded-full border border-red-500/60 bg-black/70 shadow-[0_0_18px_rgba(248,113,113,0.55)] overflow-hidden flex items-center justify-center text-sm font-semibold text-red-200">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={username}
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials(username)}</span>
              )}
            </div>

            <div>
              <div className="text-xs tracking-wide text-slate-400">
                Панель управления
              </div>
              <div className="text-sm font-semibold text-slate-50">
                FORUM
              </div>
            </div>
          </div>

          <nav className="space-y-1 text-sm">
            {navItems
              .filter((item) => (item.superadmin ? role === "SUPERADMIN" : true))
              .map((item) => (
                <NavItem key={item.href} href={item.href} label={item.label} />
              ))}
          </nav>
        </div>

        <div className="px-5 py-4 border-t border-white/5 flex items-center gap-3 text-xs text-slate-500">
          <div className="h-7 w-7 rounded-full border border-white/15 bg-black/60 flex items-center justify-center text-[10px] text-slate-300">
            N
          </div>
          <div className="leading-tight">
            <div className="font-medium text-slate-300">Forum Admin Panel</div>
            <div className="text-[10px] text-slate-500">
              © {new Date().getFullYear()} • only admins use
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* top bar */}
        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl">
          <div className="text-[11px] text-slate-400">
            Вход выполнен как{" "}
            <span className="font-semibold text-slate-100">{username}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] tracking-wide text-slate-400">
              {role === "SUPERADMIN" ? "SUPERADMIN" : "ADMIN"}
            </span>

            {/* кружок справа в шапке */}
            <div className="h-9 w-9 rounded-full bg-black/80 border border-red-500/60 shadow-[0_0_16px_rgba(248,113,113,0.6)] overflow-hidden flex items-center justify-center text-sm font-semibold text-red-100">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={username}
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{initials(username)}</span>
              )}
            </div>
          </div>
        </header>

        {/* content */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-10">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-xl px-3 py-2 text-slate-300 hover:text-slate-50 hover:bg-red-500/10 border border-transparent hover:border-red-500/40 transition-all duration-200"
    >
      <span className="text-[13px]">{label}</span>
      <span className="h-1 w-1 rounded-full bg-red-500/60 opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}