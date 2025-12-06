
import { ReactNode } from "react";
import Link from "next/link";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import { LogoutButton } from "./LogoutButton";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Gavel,
  UserCircle2,
  BarChart3,
  Settings2,
} from "lucide-react";

type NavItemConfig = {
  href: string;
  label: string;
  icon: LucideIcon;
  superadmin?: boolean;
};

const navItems: NavItemConfig[] = [
  { href: "/", label: "Главная", icon: LayoutDashboard },
  { href: "/punishments", label: "Наказания", icon: Gavel },
  { href: "/profile", label: "Профиль", icon: UserCircle2 },
  {
    href: "/admin-stats",
    label: "Статистика",
    icon: BarChart3,
    superadmin: true,
  },
  {
    href: "/settings",
    label: "Настройки",
    icon: Settings2,
    superadmin: true,
  },
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
  const avatarUrl = payload?.avatarUrl ?? null;

  return (
    <div className="relative min-h-screen text-slate-100 flex bg-transparent">

      <div className="pointer-events-none fixed inset-0 -z-10 bg-black/35 backdrop-blur-[3px]" />

      {/* SIDEBAR */}
      <aside className="hidden md:flex w-64 flex-col justify-between border-r border-white/5 bg-black/70 backdrop-blur-xl">
        <div className="px-5 pt-5 pb-4">

          <div className="flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-full border border-red-500/60 bg-black/70 shadow-[0_0_18px_rgba(248,113,113,0.55)] overflow-hidden flex items-center justify-center text-sm font-semibold text-red-200">
              {avatarUrl ? (
                <img
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
              <div className="text-sm font-semibold text-slate-50">FORUM</div>
            </div>
          </div>

          {/* навигация */}
          <nav className="space-y-2 text-sm">
            {navItems
              .filter((item) => (item.superadmin ? role === "SUPERADMIN" : true))
              .map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  Icon={item.icon}
                />
              ))}
          </nav>
        </div>

        {/* НИЖНИЙ БЛОК + ВЫХОД */}
        <div className="px-5 py-5 border-t border-white/5">
          <div className="flex items-center justify-between">
            {/* текст слева */}
            <div className="leading-tight text-xs text-slate-500">
              <div className="font-medium text-slate-300">Forum Admin Panel</div>
              <div className="text-[10px] text-slate-500">
                © {new Date().getFullYear()} created by anti
              </div>
            </div>


            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* MAIN AREA (шапка + контент) */}
      <div className="flex-1 flex flex-col min-w-0">

        <header className="flex items-center justify-between px-4 md:px-8 py-4 border-b border-white/5 bg-black/60 backdrop-blur-xl">
          <div className="text-[11px] text-slate-400">
            Вход выполнен как{" "}
            <span className="font-semibold text-slate-100">{username}</span>
          </div>


          <div className="relative inline-flex items-center">
            <div className="absolute inset-0 -z-10 blur-lg bg-white/15 opacity-35 rounded-full" />

            <a
              href="https://forum.majestic-rp.ru/"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-80 hover:opacity-100 transition"
            >
              <img
                src="/logo.webp"
                alt="Majestic Logo"
                width={140}
                height={38}
                className="object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.25)]"
              />
            </a>
          </div>
        </header>

        {/* контент */}
        <main className="flex-1 min-w-0 px-4 md:px-8 py-6 md:py-10">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function NavItem({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-2xl px-3 py-2.5 text-slate-200
                 bg-black/60 border border-white/10
                 hover:bg-red-500/10 hover:border-red-400/60
                 transition-all duration-200"
    >
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-slate-400 group-hover:text-red-300 transition-colors" />
        <span className="text-[13px]">{label}</span>
      </div>

      <span className="h-1.5 w-1.5 rounded-full bg-red-500/70 opacity-0 group-hover:opacity-100 transition" />
    </Link>
  );
}