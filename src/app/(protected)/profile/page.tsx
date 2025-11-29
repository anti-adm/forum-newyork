// src/app/(protected)/profile/page.tsx
"use client";

import React, { useEffect, useState } from "react";

type AdminTagType =
  | "NONE"
  | "LOG_HUNTER"
  | "CHEAT_HUNTER"
  | "FORUM"
  | "CHIEF"
  | "SENIOR";

interface ProfileMeResponse {
  username: string;
  role: "ADMIN" | "SUPERADMIN";
  adminTag: AdminTagType;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
}

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

function getTagLabel(tag: AdminTagType) {
  switch (tag) {
    case "LOG_HUNTER":
      return "LogHunter";
    case "CHEAT_HUNTER":
      return "CheatHunter";
    case "FORUM":
      return "Forum";
    case "CHIEF":
      return "Chief";
    case "SENIOR":
      return "Senior";
    case "NONE":
    default:
      return "Без приписки";
  }
}

export default function ProfilePage() {
  // данные профиля
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // аватар
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  // пароль
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // 2FA
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "qr" | "confirm">("idle");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);

  // загрузка профиля
  useEffect(() => {
    async function load() {
      try {
        setLoadingProfile(true);
        const res = await fetch("/api/profile/me");
        const data = await res.json();
        if (!res.ok) {
          console.error(data);
          return;
        }
        setProfile(data as ProfileMeResponse);
      } finally {
        setLoadingProfile(false);
      }
    }
    load();
  }, []);

  // --- АВАТАР ---

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    const form = new FormData();
    form.append("avatar", file);

    try {
      setAvatarUploading(true);
      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось загрузить аватар");
        return;
      }
      setProfile((prev) =>
        prev ? { ...prev, avatarUrl: data.avatarUrl as string } : prev
      );
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function handleAvatarDelete() {
    if (!confirm("Удалить аватар?")) return;
    try {
      setAvatarDeleting(true);
      const res = await fetch("/api/profile/avatar", {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Не удалось удалить аватар");
        return;
      }
      setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
    } finally {
      setAvatarDeleting(false);
    }
  }

  // --- ПАРОЛЬ ---

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordMsg("Заполни оба поля.");
      return;
    }
    try {
      setPasswordSaving(true);
      setPasswordMsg(null);

      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg(data.error || "Ошибка при смене пароля");
        return;
      }

      setPasswordMsg("Пароль успешно изменён.");
      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setPasswordSaving(false);
    }
  }

  // --- 2FA ---

  async function start2FA() {
    try {
      setTwoFaLoading(true);
      setTwoFaMsg(null);

      const res = await fetch("/api/profile/2fa/setup", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Не удалось начать настройку 2FA");
        return;
      }

      setQr(data.qr);
      setSecret(data.secret);
      setTwoFaStep("qr");
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function confirm2FA() {
    try {
      setTwoFaLoading(true);
      setTwoFaMsg(null);

      const res = await fetch("/api/profile/2fa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: twoFaCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Неверный код");
        return;
      }

      setTwoFaMsg("2FA успешно подключено.");
      setTwoFaStep("idle");
      setQr(null);
      setSecret(null);
      setTwoFaCode("");
      setProfile((prev) =>
        prev ? { ...prev, twoFactorEnabled: true } : prev
      );
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function disable2FA() {
    if (!confirm("Отключить двухфакторную аутентификацию?")) return;

    try {
      setTwoFaLoading(true);
      setTwoFaMsg(null);

      const res = await fetch("/api/profile/2fa/disable", {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Не удалось отключить 2FA");
        return;
      }

      setTwoFaMsg("2FA отключено.");
      setTwoFaStep("idle");
      setQr(null);
      setSecret(null);
      setTwoFaCode("");
      setProfile((prev) =>
        prev ? { ...prev, twoFactorEnabled: false } : prev
      );
    } finally {
      setTwoFaLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Профиль</h1>
        <p className="text-xs text-slate-400">
          Управляй своим аватаром, паролем и двухфакторной аутентификацией.
        </p>
      </div>

      {/* --- верхняя карточка профиля: аватар + инфа --- */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] flex flex-col md:flex-row gap-6 md:items-center">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border border-red-500/60 bg-black/80 shadow-[0_0_20px_rgba(248,113,113,0.7)] overflow-hidden flex items-center justify-center text-xl font-semibold text-red-100">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt="avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              (profile?.username?.[0] ?? "A").toUpperCase()
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-50">
              {profile?.username ?? "Загрузка..."}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="px-2 py-0.5 rounded-full bg-white/5 border border-white/20 text-slate-100">
                {profile?.role ?? "ADMIN"}
              </span>
              {profile && (
                <span
                  className={
                    "px-2 py-0.5 rounded-full border text-[11px] " +
                    getTagStyles(profile.adminTag)
                  }
                >
                  {getTagLabel(profile.adminTag)}
                </span>
              )}
              {profile?.twoFactorEnabled && (
                <span className="px-2 py-0.5 rounded-full border border-emerald-400/70 bg-emerald-500/15 text-emerald-200">
                  2FA включена
                </span>
              )}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              Формат PNG/WebP/jpeg.
            </p>
          </div>
        </div>

        {/* кнопки под аватаром */}
        <div className="flex flex-wrap gap-3 md:ml-auto">
          <label className="inline-flex items-center justify-center rounded-2xl border border-white/60 bg-black/90 px-4 py-2 text-xs font-semibold text-slate-50 shadow-[0_0_14px_rgba(248,250,252,0.8)] hover:bg-black hover:border-red-400 hover:shadow-[0_0_22px_rgba(248,113,113,0.9)] transition cursor-pointer disabled:opacity-50">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
              disabled={avatarUploading}
            />
            {avatarUploading ? "Загрузка..." : "Загрузить аватар"}
          </label>

          <button
            onClick={handleAvatarDelete}
            disabled={avatarDeleting || !profile?.avatarUrl}
            className="inline-flex items-center justify-center rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20 transition disabled:opacity-40"
          >
            {avatarDeleting ? "Удаляем..." : "Удалить аватар"}
          </button>
        </div>
      </section>

      {/* --- смена пароля --- */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">Смена пароля</h2>
        <form
          onSubmit={handlePasswordChange}
          className="grid gap-3 md:grid-cols-2 md:gap-4 text-xs"
        >
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
          <div className="md:col-span-2 flex items-center justify-between pt-1">
            <p className="text-[11px] text-slate-500">
              Не делись паролем ни с кем, даже с куратором.
            </p>
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center rounded-2xl border border_WHITE/60 bg-black/90 px-4 py-2 text-xs font-semibold text-slate-50 shadow-[0_0_14px_rgba(248,250,252,0.8)] hover:bg-black hover:border-red-400 hover:shadow-[0_0_22px_rgba(248,113,113,0.9)] transition disabled:opacity-50"
            >
              {passwordSaving ? "Сохраняем..." : "Сохранить пароль"}
            </button>
          </div>
        </form>
        {passwordMsg && (
          <p className="text-[11px] text-slate-300 mt-1">{passwordMsg}</p>
        )}
      </section>

      {/* --- 2FA --- */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Двухфакторная аутентификация (2FA)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Привяжи Google Authenticator, чтобы защитить вход в админ-панель.
            </p>
          </div>

          {profile?.twoFactorEnabled && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full border border-emerald-400/70 bg-emerald-500/15 text-[11px] text-emerald-200">
                Уже включена
              </span>
              <button
                type="button"
                onClick={disable2FA}
                disabled={twoFaLoading}
                className="text-[11px] px-3 py-1.5 rounded-xl border border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition disabled:opacity-50"
              >
                Отключить
              </button>
            </div>
          )}
        </div>

        {/* старт */}
        {twoFaStep === "idle" && !qr && !profile?.twoFactorEnabled && (
          <button
            onClick={start2FA}
            disabled={twoFaLoading}
            className="mt-2 inline-flex items-center rounded-2xl border border-white/60 bg-black/90 px-4 py-2 text-xs font-semibold text-slate-50 shadow-[0_0_14px_rgba(248,113,113,0.45)] hover:bg-black hover:border-red-400 hover:shadow-[0_0_22px_rgba(248,113,113,0.9)] transition disabled:opacity-50"
          >
            {twoFaLoading ? "Подготавливаем..." : "Включить 2FA"}
          </button>
        )}

        {/* QR */}
        {twoFaStep === "qr" && qr && (
          <div className="mt-3 grid gap-4 md:grid-cols-[auto,1fr] items-center">
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl border border-white/10 bg-black/80 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt="QR code"
                  className="w-40 h-40 md:w-48 md:h-48 rounded-xl"
                />
              </div>
              <span className="text-[11px] text-slate-500">
                Отсканируй в Google Authenticator
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>
                1. Открой приложение{" "}
                <span className="font-semibold">Google Authenticator</span> /
                Aegis / Authy.
              </p>
              <p>2. Добавь новый аккаунт и отсканируй QR-код слева.</p>
              <p className="text-[11px] text-slate-500">
                Если камера недоступна, введи секрет вручную:
                <br />
                <span className="text-slate-200 break-all">{secret}</span>
              </p>

              <button
                onClick={() => setTwoFaStep("confirm")}
                className="inline-flex items-center rounded-2xl border border-white/40 px-4 py-2 text-[11px] font-semibold text-slate-100 hover:bg-white/5 transition"
              >
                Далее — ввести код
              </button>
            </div>
          </div>
        )}

        {/* ввод кода */}
        {twoFaStep === "confirm" && (
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-400">
              Введи 6-значный код из приложения аутентификации.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={twoFaCode}
                onChange={(e) =>
                  setTwoFaCode(e.target.value.replace(/\D/g, ""))
                }
                maxLength={6}
                className="w-32 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-center text-lg tracking-[0.35em] text-slate-50 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                placeholder="••••••"
              />
              <button
                onClick={confirm2FA}
                disabled={twoFaLoading || twoFaCode.length < 6}
                className="inline-flex items-center rounded-2xl border border-white/60 bg-black/90 px-4 py-2 text-xs font-semibold text-slate-50 shadow-[0_0_14px_rgba(34,197,94,0.55)] hover:bg-black hover:border-green-400 hover:shadow-[0_0_22px_rgba(34,197,94,0.9)] transition disabled:opacity-50"
              >
                {twoFaLoading ? "Проверяем..." : "Подтвердить код"}
              </button>
            </div>
          </div>
        )}

        {twoFaMsg && (
          <p className="mt-2 text-[11px] text-emerald-400">{twoFaMsg}</p>
        )}
      </section>

      {loadingProfile && (
        <div className="text-[11px] text-slate-500">Загружаем профиль…</div>
      )}
    </div>
  );
}