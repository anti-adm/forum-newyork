// src/app/(protected)/profile/profile-client.tsx
"use client";

import { FormEvent, useState } from "react";

type Props = {
  username: string;
  role: string;
  adminTag: string;
  initialAvatarUrl: string | null;
};

export default function ProfileClient({
  username,
  role,
  adminTag,
  initialAvatarUrl,
}: Props) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    setAvatarLoading(true);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Ошибка загрузки аватара");
      } else {
        setAvatarUrl(data.avatarUrl);
      }
    } catch (err) {
      console.error(err);
      alert("Сетевая ошибка при загрузке аватара");
    } finally {
      setAvatarLoading(false);
      e.target.value = "";
    }
  }

  async function handleAvatarDelete() {
    if (!confirm("Удалить аватар?")) return;

    setAvatarLoading(true);
    try {
      const res = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось удалить аватар");
      } else {
        setAvatarUrl(null);
      }
    } catch (err) {
      console.error(err);
      alert("Сетевая ошибка при удалении аватара");
    } finally {
      setAvatarLoading(false);
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== newPassword2) {
      setPasswordError("Новый пароль и подтверждение не совпадают");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordError(data.error || "Не удалось сменить пароль");
      } else {
        setPasswordSuccess("Пароль успешно обновлён");
        setCurrentPassword("");
        setNewPassword("");
        setNewPassword2("");
      }
    } catch (err) {
      console.error(err);
      setPasswordError("Сетевая ошибка");
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr,1.6fr]">
      {/* Блок аватара */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">Аватар</h2>

        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 rounded-full border border-white/20 bg-black/80 shadow-[0_0_26px_rgba(248,113,113,0.35)] overflow-hidden flex items-center justify-center text-xl font-semibold text-slate-100">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt="avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              username[0]?.toUpperCase()
            )}
          </div>

          <div className="text-xs text-slate-400 space-y-1.5">
            <div className="text-sm text-slate-100">{username}</div>
            <div className="flex gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/15">
                {role}
              </span>
              {adminTag && adminTag !== "NONE" && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/50 text-red-200">
                  {adminTag}
                </span>
              )}
            </div>
            <p>Формат PNG/JPEG/WebP.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <label className="inline-flex items-center justify-center rounded-2xl px-4 py-2 border border-white/40 bg-black/80 text-slate-50 cursor-pointer hover:border-red-400 hover:shadow-[0_0_20px_rgba(248,113,113,0.7)] transition">
            {avatarLoading ? "Загрузка..." : "Загрузить аватар"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={avatarLoading}
            />
          </label>

          {avatarUrl && (
            <button
              type="button"
              onClick={handleAvatarDelete}
              disabled={avatarLoading}
              className="inline-flex items-center justify-center rounded-2xl px-4 py-2 border border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              Удалить аватар
            </button>
          )}
        </div>
      </section>

      {/* Блок смены пароля */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">Смена пароля</h2>

        <form className="space-y-3 text-xs" onSubmit={handlePasswordChange}>
          <div className="space-y-1.5">
            <label className="block text-slate-400">Текущий пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-slate-400">Повтор нового пароля</label>
            <input
              type="password"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
            />
          </div>

          {passwordError && (
            <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="rounded-xl border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200">
              {passwordSuccess}
            </div>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className="mt-1 inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold bg-black/85 border border-white/60 text-slate-50 shadow-[0_0_16px_rgba(248,113,113,0.7)] hover:bg-black/95 hover:border-red-400 hover:shadow-[0_0_24px_rgba(248,113,113,1)] transition disabled:opacity-50 disabled:shadow-none"
          >
            {passwordLoading ? "Сохраняем..." : "Обновить пароль"}
          </button>
        </form>
      </section>
    </div>
  );
}