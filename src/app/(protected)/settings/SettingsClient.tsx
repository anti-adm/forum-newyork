// src/app/(protected)/settings/SettingsClient.tsx
'use client';

import { useEffect, useState } from 'react';

type Admin = {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  isSystem: boolean;
};

type LogItem = {
  id: number;
  adminId: number;
  adminName: string;
  action: string;
  meta?: string | null;
  createdAt: string;
};

export default function SettingsClient() {
  const [norm, setNorm] = useState('');
  const [normLoading, setNormLoading] = useState(true);
  const [normError, setNormError] = useState<string | null>(null);

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(true);
  const [adminsError, setAdminsError] = useState<string | null>(null);

  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  const [newAdminLogin, setNewAdminLogin] = useState('');
  const [newAdminRole, setNewAdminRole] = useState('ADMIN');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  useEffect(() => {
    async function loadNorm() {
      try {
        const res = await fetch('/api/settings/norm');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка');
        setNorm(String(data.value ?? 0));
      } catch (err) {
        console.error(err);
        setNormError('Не удалось загрузить норму');
      } finally {
        setNormLoading(false);
      }
    }
    async function loadAdmins() {
      try {
        const res = await fetch('/api/superadmin/admins');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка');
        setAdmins(data);
      } catch (err) {
        console.error(err);
        setAdminsError('Не удалось загрузить список админов');
      } finally {
        setAdminsLoading(false);
      }
    }
    async function loadLogs() {
      try {
        const res = await fetch('/api/superadmin/logs?limit=30');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Ошибка');
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLogsLoading(false);
      }
    }

    loadNorm();
    loadAdmins();
    loadLogs();
  }, []);

  async function saveNorm() {
    setNormError(null);
    setNormLoading(true);
    try {
      const res = await fetch('/api/settings/daily-norm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: Number(norm) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNormError(data.error || 'Ошибка сохранения');
      } else {
        setNorm(String(data.value));
      }
    } catch (err) {
      console.error(err);
      setNormError('Сетевая ошибка');
    } finally {
      setNormLoading(false);
    }
  }

  async function createAdmin() {
    if (!newAdminLogin.trim()) return;
    setCreatingAdmin(true);
    setAdminsError(null);
    try {
      const res = await fetch('/api/superadmin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newAdminLogin.trim(),
          role: newAdminRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminsError(data.error || 'Ошибка создания админа');
      } else {
        setAdmins((prev) => [...prev, data.admin]);
        setNewAdminLogin('');
        alert(
          `Админ создан:\nЛогин: ${data.admin.username}\nПароль: ${data.password}`,
        );
      }
    } catch (err) {
      console.error(err);
      setAdminsError('Сетевая ошибка');
    } finally {
      setCreatingAdmin(false);
    }
  }

  async function toggleAccess(a: Admin) {
    try {
      const res = await fetch('/api/superadmin/admins/toggle-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: a.id, isActive: !a.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка изменения статуса');
      } else {
        setAdmins((prev) =>
          prev.map((x) =>
            x.id === a.id ? { ...x, isActive: data.isActive } : x,
          ),
        );
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка');
    }
  }

  async function resetPassword(a: Admin) {
    if (!confirm(`Сбросить пароль для ${a.username}?`)) return;
    try {
      const res = await fetch(
        '/api/superadmin/admins/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: a.id }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка сброса пароля');
      } else {
        alert(`Новый пароль для ${a.username}:\n${data.password}`);
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка');
    }
  }

  async function deleteAdmin(a: Admin) {
    if (
      !confirm(
        `Удалить администратора ${a.username}? Это действие необратимо.`,
      )
    )
      return;
    try {
      const res = await fetch('/api/superadmin/admins/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: a.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Ошибка удаления');
      } else {
        setAdmins((prev) => prev.filter((x) => x.id !== a.id));
      }
    } catch (err) {
      console.error(err);
      alert('Сетевая ошибка');
    }
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h1 className="text-2xl font-semibold text-slate-50">
        Настройки супер-админа
      </h1>

      {/* Норма */}
      <div className="glass-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Сегодняшняя норма
        </h2>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Кол-во наказаний в день
            </label>
            <input
              className="w-32 rounded-lg border border-slate-700 bg-black/80 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-slate-100 focus:shadow-[0_0_10px_rgba(248,250,252,0.7)]"
              value={norm}
              onChange={(e) => setNorm(e.target.value)}
            />
          </div>
          <button
            onClick={saveNorm}
            disabled={normLoading}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-black/85 px-4 py-2 text-xs font-semibold text-slate-50 shadow-[0_0_12px_rgba(248,250,252,0.85)] transition hover:bg-slate-900 hover:shadow-[0_0_18px_rgba(248,250,252,1)] disabled:opacity-60"
          >
            Сохранить
          </button>
        </div>
        {normError && (
          <div className="mt-2 text-xs text-red-300">{normError}</div>
        )}
      </div>

      {/* Админы */}
      <div className="glass-panel space-y-4 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          Управление администраторами
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-slate-400">
              Логин нового админа
            </label>
            <input
              className="w-full rounded-lg border border-slate-700 bg-black/80 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-slate-100 focus:shadow-[0_0_10px_rgba(248,250,252,0.7)]"
              value={newAdminLogin}
              onChange={(e) => setNewAdminLogin(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-400">
              Роль
            </label>
            <select
              className="w-40 rounded-lg border border-slate-700 bg-black/80 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-slate-100 focus:shadow-[0_0_10px_rgba(248,250,252,0.7)]"
              value={newAdminRole}
              onChange={(e) => setNewAdminRole(e.target.value)}
            >
              <option value="ADMIN">ADMIN</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={createAdmin}
              disabled={creatingAdmin}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-black/85 px-4 py-2 text-xs font-semibold text-slate-50 shadow-[0_0_12px_rgba(248,250,252,0.85)] transition hover:bg-slate-900 hover:shadow-[0_0_18px_rgba(248,250,252,1)] disabled:opacity-60"
            >
              {creatingAdmin ? 'Создание...' : 'Создать админа'}
            </button>
          </div>
        </div>

        {adminsError && (
          <div className="text-xs text-red-300">{adminsError}</div>
        )}

        <div className="mt-3 overflow-x-auto text-xs">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">Логин</th>
                <th className="px-2 py-1 text-left">Роль</th>
                <th className="px-2 py-1 text-left">Статус</th>
                <th className="px-2 py-1 text-left">Действия</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr
                  key={a.id}
                  className="bg-black/80 transition-colors hover:bg-black"
                >
                  <td className="px-2 py-1">
                    <div className="font-medium text-slate-50">
                      {a.username}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      ID: {a.id}
                    </div>
                  </td>
                  <td className="px-2 py-1">{a.role}</td>
                  <td className="px-2 py-1">
                    <button
                      onClick={() => toggleAccess(a)}
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${
                        a.isActive
                          ? 'border-slate-200 bg-slate-100/10 text-slate-50'
                          : 'border-slate-500 bg-black/80 text-slate-200'
                      }`}
                    >
                      {a.isActive ? 'Активен' : 'Отключён'}
                    </button>
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-2">
                      <button
                        onClick={() => resetPassword(a)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-[11px] text-slate-50 shadow-[0_0_8px_rgba(248,250,252,0.7)] transition hover:bg-slate-900"
                      >
                        Пароль
                      </button>
                      <button
                        onClick={() => deleteAdmin(a)}
                        className="rounded-lg border border-red-500/70 px-3 py-1 text-[11px] text-red-200 hover:bg-red-500/10"
                      >
                        Удалить
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!adminsLoading && admins.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-2 py-3 text-center text-slate-500"
                  >
                    Администраторы не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Логи */}
      <div className="glass-panel p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">
          Журнал действий админов
        </h2>
        {logsLoading ? (
          <div className="text-xs text-slate-400">
            Загрузка логов...
          </div>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-separate border-spacing-y-1">
              <thead className="text-slate-400">
                <tr>
                  <th className="px-2 py-1 text-left">Админ</th>
                  <th className="px-2 py-1 text-left">Действие</th>
                  <th className="px-2 py-1 text-left">Время</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className="bg-black/80 transition-colors hover:bg-black"
                  >
                    <td className="px-2 py-1">
                      <div className="font-medium text-slate-50">
                        {l.adminName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        ID: {l.adminId}
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <div className="font-mono text-[11px] text-slate-100">
                        {l.action}
                      </div>
                      {l.meta && (
                        <div className="text-[11px] text-slate-500">
                          {l.meta}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1 text-[11px] text-slate-300">
                      {new Date(l.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-3 text-center text-slate-500"
                    >
                      Логов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[11px] text-slate-500">
          Очистку логов можно делать вручную через Prisma Studio либо
          добавить отдельный API-метод при необходимости.
        </p>
      </div>
    </div>
  );
}