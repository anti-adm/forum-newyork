// src/app/(protected)/settings/page.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";

type AdminTagType =
  | "NONE"
  | "LOG_HUNTER"
  | "CHEAT_HUNTER"
  | "FORUM"
  | "CHIEF"
  | "SENIOR";

interface AdminUser {
  id: number;
  username: string;
  role: "ADMIN" | "SUPERADMIN";
  isActive: boolean;
  isSystem: boolean;
  adminTag: AdminTagType;
  avatarUrl: string | null;
  twoFactorEnabled: boolean; // 👈 добавили флаг 2FA
}

interface AdminLogItem {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  meta: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [dailyNorm, setDailyNorm] = useState("");
  const [normLoading, setNormLoading] = useState(false);

  const [newTag, setNewTag] = useState<AdminTagType>("NONE");

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  const [newLogin, setNewLogin] = useState("");
  const [newRole, setNewRole] = useState<"ADMIN" | "SUPERADMIN">("ADMIN");

  const [logs, setLogs] = useState<AdminLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  function getTagStyles(tag: AdminTagType) {
    switch (tag) {
      case "LOG_HUNTER":
        return "bg-sky-500/15 border-sky-400/60 text-sky-200";
      case "CHEAT_HUNTER":
        return "bg-purple-500/20 border-purple-400/80 text-purple-100";
      case "SENIOR":
        return "bg-fuchsia-500/25 border-fuchsia-400/90 text-fuchsia-100";
      case "CHIEF":
        return "bg-teal-500/20 border-teal-400/80 text-teal-100";
      case "FORUM":
        return "bg-red-500/25 border-red-500/80 text-red-100";
      case "NONE":
      default:
        return "bg-slate-800/60 border-slate-600/70 text-slate-200";
    }
  }

  useEffect(() => {
    loadNorm();
    loadAdmins();
    loadLogs();
  }, []);

  async function loadNorm() {
    setNormLoading(true);
    try {
      const res = await fetch("/api/settings/norm");
      if (res.ok) {
        const data = await res.json();
        setDailyNorm(String(data.value ?? 0));
      }
    } finally {
      setNormLoading(false);
    }
  }

  async function saveNorm(e: FormEvent) {
    e.preventDefault();
    const value = parseInt(dailyNorm || "0", 10);
    if (isNaN(value) || value < 0) return;

    setNormLoading(true);
    try {
      await fetch("/api/settings/daily-norm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
    } finally {
      setNormLoading(false);
    }
  }

  async function loadAdmins() {
    setAdminsLoading(true);
    try {
      const res = await fetch("/api/superadmin/admins");
      if (res.ok) {
        const data = await res.json();
        setAdmins(data);
      }
    } finally {
      setAdminsLoading(false);
    }
  }

  async function createAdmin(e: FormEvent) {
    e.preventDefault();
    if (!newLogin.trim()) return;

    const res = await fetch("/api/superadmin/admins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newLogin.trim(),
        role: newRole,
        adminTag: newTag,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      alert(
        `Админ создан:\nЛогин: ${data.admin.username}\nПароль: ${data.password}`
      );
      setNewLogin("");
      setNewTag("NONE");
      await loadAdmins();
    }
  }

  async function toggleAdmin(userId: number, isActive: boolean) {
    await fetch("/api/superadmin/admins/toggle-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, isActive }),
    });
    await loadAdmins();
  }

  async function resetPassword(userId: number, username: string) {
    const res = await fetch("/api/superadmin/admins/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    if (res.ok) {
      const data = await res.json();
      alert(
        `Новый пароль для ${username}:\n${data.password}\n\nСохрани — повторно посмотреть нельзя.`
      );
    }
  }

  async function deleteAdmin(userId: number, username: string) {
    if (!confirm(`Удалить администратора ${username}?`)) return;

    await fetch("/api/superadmin/admins/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    await loadAdmins();
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/superadmin/logs?limit=30");
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } finally {
      setLogsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Настройки супер-админа</h1>
        <p className="text-xs text-slate-400">
          Управление нормами, администраторами и журналом действий.
        </p>
      </div>

      {/* НОРМА */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">
          Сегодняшняя норма
        </h2>

        <form
          onSubmit={saveNorm}
          className="flex flex-col sm:flex-row gap-4 sm:items-end"
        >
          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-400">
              Кол-во наказаний в день
            </label>
            <input
              value={dailyNorm}
              onChange={(e) => setDailyNorm(e.target.value)}
              className="w-40 h-[42px] rounded-xl bg-black/60 border border-white/10 px-3 text-sm text-slate-50 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            />
          </div>

          <button
            type="submit"
            disabled={normLoading}
            className="h-[42px] inline-flex items-center justify-center
                      rounded-2xl px-5 text-sm font-semibold
                      bg-black/85 border border-white/60 text-slate-50
                      shadow-[0_0_14px_rgba(248,113,113,0.45)]
                      hover:bg-black/95 hover:border-red-400 hover:shadow-[0_0_24px_rgba(248,113,113,0.9)]
                      transition
                      disabled:opacity-50 disabled:shadow-none"
          >
            {normLoading ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>
      </section>

      {/* АДМИНЫ */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4">
        <h2 className="text-sm font-semibold">Управление администраторами</h2>

        {/* создание админа */}
        <form
          onSubmit={createAdmin}
          className="grid gap-3 md:grid-cols-[1.5fr,150px,150px,auto]"
        >
          {/* логин */}
          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-400">Логин нового админа</label>
            <input
              value={newLogin}
              onChange={(e) => setNewLogin(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            />
          </div>

          {/* роль */}
          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-400">Роль</label>
            <select
              value={newRole}
              onChange={(e) =>
                setNewRole(e.target.value as "ADMIN" | "SUPERADMIN")
              }
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
          </div>

          {/* тег */}
          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-400">Тег администратора</label>
            <select
              value={newTag}
              onChange={(e) => setNewTag(e.target.value as AdminTagType)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            >
              <option value="NONE">Без тега</option>
              <option value="LOG_HUNTER">LogHunter</option>
              <option value="CHEAT_HUNTER">CheatHunter</option>
              <option value="SENIOR">Senior</option>
              <option value="CHIEF">Chief</option>
              <option value="FORUM">Forum</option>
            </select>
          </div>

          {/* кнопка */}
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-2xl bg-black/80 border border-white/10 text-slate-50 py-2.5
                         shadow-[0_0_18px_rgba(255,40,40,0.35)]
                         hover:border-red-400 hover:shadow-[0_0_28px_rgba(255,60,60,0.7)]
                         transition"
            >
              Создать админа
            </button>
          </div>
        </form>

        {/* таблица админов */}
        <div className="mt-4 overflow-x-auto text-xs">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="text-left pr-4 pb-1">Логин</th>
                <th className="text-left pr-4 pb-1">Роль</th>
                <th className="text-left pr-4 pb-1">Тег</th>
                <th className="text-left pr-4 pb-1">Статус</th>
                <th className="text-left pb-1">Действия</th>
              </tr>
            </thead>

            <tbody>
              {admins.map((u) => (
                <tr key={u.id}>
                  <td className="pr-4 text-slate-100">{u.username}</td>

                  {/* роль */}
                  <td className="pr-4 text-slate-200 text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15">
                      {u.role}
                    </span>
                  </td>

                  {/* тег */}
                  <td className="pr-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] border ${getTagStyles(
                        u.adminTag
                      )}`}
                    >
                      {u.adminTag.replace("_", " ")}
                    </span>
                  </td>

                  {/* статус + 2FA */}
                  <td className="pr-4">
                    <div className="flex items-center gap-2">
                      <button
                        disabled={u.isSystem}
                        onClick={() => toggleAdmin(u.id, !u.isActive)}
                        className={`px-2.5 py-0.5 rounded-full text-[11px] border ${
                          u.isActive
                            ? "bg-green-500/15 border-green-500/40 text-green-200"
                            : "bg-slate-700/40 border-slate-500/60 text-slate-200"
                        } ${
                          u.isSystem ? "opacity-40 cursor-not-allowed" : ""
                        }`}
                      >
                        {u.isActive ? "Активен" : "Отключён"}
                      </button>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] border ${
                          u.twoFactorEnabled
                            ? "bg-sky-500/15 border-sky-400/60 text-sky-200"
                            : "bg-slate-800/50 border-slate-600/70 text-slate-300"
                        }`}
                      >
                        {u.twoFactorEnabled ? "2FA Вкл" : "2FA Выкл"}
                      </span>
                    </div>
                  </td>

                  {/* действия */}
                  <td className="space-x-2">
                    <button
                      disabled={u.isSystem}
                      onClick={() => resetPassword(u.id, u.username)}
                      className="text-[11px] px-2.5 py-1 rounded-xl border border-white/15 hover:bg-white/5 disabled:opacity-40"
                    >
                      Пароль
                    </button>

                    <button
                      disabled={u.isSystem}
                      onClick={() => deleteAdmin(u.id, u.username)}
                      className="text-[11px] px-2.5 py-1 rounded-xl border border-red-500/40 text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}

              {admins.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center text-slate-500 text-xs py-3"
                  >
                    Администраторы не найдены.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ЛОГИ */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Журнал действий админов</h2>
          <button
            onClick={loadLogs}
            className="text-[11px] px-3 py-1.5 rounded-xl border border-white/15 text-slate-300 hover:bg-white/5"
          >
            Обновить
          </button>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="text-left pr-4 pb-1">Админ</th>
                <th className="text-left pr-4 pb-1">Действие</th>
                <th className="text-left pb-1">Время</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="pr-4 text-slate-100">{log.adminName}</td>
                  <td className="pr-4">
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] text-red-200">
                        {log.action}
                      </span>
                      {log.meta && (
                        <span className="text-[11px] text-slate-400">
                          {log.meta}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-[11px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString("ru-RU")}
                  </td>
                </tr>
              ))}

              {!logs.length && !logsLoading && (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center text-slate-500 text-xs py-3"
                  >
                    Записей пока нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {logsLoading && (
          <div className="text-[11px] text-slate-500">Загружаем журнал…</div>
        )}
      </section>
    </div>
  );
}