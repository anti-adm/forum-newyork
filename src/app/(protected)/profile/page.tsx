"use client";

import React, { useEffect, useState } from "react";

type AdminTagType =
  | "NONE"
  | "LOG_HUNTER"
  | "CHEAT_HUNTER"
  | "FORUM"
  | "CHIEF"
  | "CHIEF_CURATOR"
  | "SENIOR"
  | "CHIEF_ADMINISTRATOR"
  | "DEPUTY_CHIEF"
  | "DEVELOPER";

interface ProfileMeResponse {
  username: string;
  role: "ADMIN" | "SUPERADMIN";
  adminTag: AdminTagType;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  forumNick: string | null;
}

/* ============================================================= */
/*                          TAG STYLES                           */
/* ============================================================= */

function getTagStyles(tag: AdminTagType) {
  switch (tag) {
    case "LOG_HUNTER":
      return "bg-sky-500/15 border-sky-400/60 text-sky-200";

    case "CHEAT_HUNTER":
      return "bg-purple-500/20 border-purple-400/80 text-purple-100";

    case "SENIOR":
      return "bg-fuchsia-500/25 border-fuchsia-400/90 text-fuchsia-100";

    case "CHIEF_CURATOR":
      return "bg-teal-500/15 border-cyan-300/90 text-teal-50";

    case "CHIEF":
      return "tag-chief";

    case "FORUM":
      return "bg-red-500/25 border-red-500/80 text-red-100";

    case "DEVELOPER":
      return "border-red-500/80 text-red-50 tag-dev";

    case "DEPUTY_CHIEF":
      return "border-cyan-300/90 text-cyan-50 tag-deputy-head";

    case "CHIEF_ADMINISTRATOR":
      return "border-sky-300/90 text-sky-50 tag-chief-admin";

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
    case "CHIEF_CURATOR":
      return "ChiefCurator";
    case "SENIOR":
      return "Senior";
    case "DEVELOPER":
      return "Developer";
    case "CHIEF_ADMINISTRATOR":
      return "ChiefAdministrator";
    case "DEPUTY_CHIEF":
      return "DeputyChief";
    case "NONE":
    default:
      return "Нет роли";
  }
}



export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileMeResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "qr" | "confirm">("idle");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);

  const [forumNickDraft, setForumNickDraft] = useState("");
  const [forumNickSaving, setForumNickSaving] = useState(false);
  const [forumNickMsg, setForumNickMsg] = useState<string | null>(null);



  useEffect(() => {
    async function load() {
      setLoadingProfile(true);

      try {
        const res = await fetch("/api/profile/me");

        // 🔐 Если admin отключён → разлогин сразу
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        let data: any = null;

        // безопасный JSON
        try {
          data = await res.json();
        } catch {
          console.warn("Ответ сервера не JSON");
        }

        if (!res.ok) {
          console.error("Ошибка API:", data);
          return;
        }

        const prof = data as ProfileMeResponse;
        setProfile(prof);
        setForumNickDraft(prof.forumNick ?? "");
      } finally {
        setLoadingProfile(false);
      }
    }

    load();
  }, []);



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
        prev ? { ...prev, avatarUrl: data.avatarUrl } : prev
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



  async function handleForumNickSave(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = forumNickDraft.trim();
    if (!trimmed) {
      setForumNickMsg("Ник не может быть пустым.");
      return;
    }

    try {
      setForumNickSaving(true);
      setForumNickMsg(null);

      const res = await fetch("/api/profile/forum-nick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forumNick: trimmed }),
      });

      let data: any = null;
      try {
        data = await res.json();
      } catch {

      }

      if (!res.ok) {
        setForumNickMsg(
          (data && data.error) || "Не удалось сохранить форумный ник."
        );
        return;
      }

      const savedNick = data?.forumNick ?? trimmed;

      setProfile((prev) =>
        prev ? { ...prev, forumNick: savedNick } : prev
      );
      setForumNickDraft(savedNick);
      setForumNickMsg("Форумный ник сохранён.");
    } finally {
      setForumNickSaving(false);
    }
  }

  /* ============================================================= */
  /*                      PASSWORD CHANGE                          */
  /* ============================================================= */

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
        setPasswordMsg(data.error || "Ошибка изменения пароля");
        return;
      }

      setPasswordMsg("Пароль успешно изменён.");
      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setPasswordSaving(false);
    }
  }

  /* ============================================================= */
  /*                           2FA                                 */
  /* ============================================================= */

  async function start2FA() {
    try {
      setTwoFaLoading(true);

      const res = await fetch("/api/profile/2fa/setup", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Не удалось включить 2FA");
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

      setTwoFaMsg("2FA включено.");
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
    if (!confirm("Отключить 2FA?")) return;

    try {
      setTwoFaLoading(true);

      const res = await fetch("/api/profile/2fa/disable", {
        method: "POST",
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || "Ошибка отключения 2FA");
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

  /* ============================================================= */
  /*                          RENDER                               */
  /* ============================================================= */

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Профиль</h1>
        <p className="text-xs text-slate-400">
          Управляй аватаром, паролем, двухфакторной защитой и форумным ником
          для автозаполнения статистики.
        </p>
      </div>

      {/* === CARD: PROFILE TOP === */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-lg flex flex-col md:flex-row gap-6 md:items-center">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full border border-red-500/60 bg-black/80 shadow-md overflow-hidden flex items-center justify-center text-xl font-semibold text-red-100">
            {profile?.avatarUrl ? (
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
                <span className="px-2 py-0.5 rounded-full border border-emerald-400/70 bg-emerald-500/15 text-emerald-200 text-[11px]">
                  2FA включена
                </span>
              )}
            </div>

            <p className="mt-2 text-[11px] text-slate-500">
              Поддерживаются PNG / WebP / JPG.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 md:ml-auto">
          <label className="cursor-pointer inline-flex items-center justify-center rounded-2xl border border-white/60 bg-black/90 px-4 py-2 text-xs font-semibold text-slate-50 shadow-md hover:border-red-400 hover:shadow-red-500/20 transition">
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
            disabled={!profile?.avatarUrl || avatarDeleting}
            className="inline-flex items-center justify-center rounded-2xl border border-red-500/60 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/20 transition disabled:opacity-40"
          >
            {avatarDeleting ? "Удаляем..." : "Удалить аватар"}
          </button>
        </div>
      </section>

      {/* === FORUM NICK === */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 py-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Форумный ник
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Ник на форуме Majestic (точно как в профиле).
            </p>
          </div>

          {profile?.forumNick && (
            <span className="px-2 py-0.5 rounded-full border border-white/15 bg-white/5 text-[11px] text-slate-200">
              Текущее значение: {profile.forumNick}
            </span>
          )}
        </div>

        <form
          onSubmit={handleForumNickSave}
          className="flex flex-col md:flex-row gap-3 text-xs md:items-center"
        >
          <div className="flex-1 space-y-1.5">
            <label className="text-slate-400 text-[11px]">
              
            </label>
            <input
              type="text"
              value={forumNickDraft}
              onChange={(e) => setForumNickDraft(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400"
              placeholder="Например: anti. или sheriff"
            />
          </div>

          <button
            type="submit"
            disabled={forumNickSaving}
            className="md:self-end px-4 py-2 rounded-2xl border border-white/60 bg-black/90 text-slate-50 text-xs font-semibold shadow-md hover:border-red-400 transition disabled:opacity-40"
          >
            {forumNickSaving ? "Сохраняем..." : "Сохранить ник"}
          </button>
        </form>

        {forumNickMsg && (
          <p className="text-[11px] text-slate-300">{forumNickMsg}</p>
        )}
      </section>

      {/* === PASSWORD === */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 py-5 shadow-lg space-y-4">
        <h2 className="text-sm font-semibold text-slate-50">Смена пароля</h2>

        <form
          onSubmit={handlePasswordChange}
          className="grid gap-3 md:grid-cols-2 text-xs"
        >
          <div className="space-y-1.5">
            <label className="text-slate-400">Текущий пароль</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-slate-400">Новый пароль</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400"
            />
          </div>

          <div className="md:col-span-2 flex justify-between items-center">
            <p className="text-[11px] text-slate-500">
              Не делись паролем ни с кем.
            </p>

            <button
              type="submit"
              disabled={passwordSaving}
              className="px-4 py-2 rounded-2xl border border-white/60 bg-black/90 text-slate-50 text-xs shadow-md hover:border-red-400 transition disabled:opacity-40"
            >
              {passwordSaving ? "Сохраняем..." : "Сохранить пароль"}
            </button>
          </div>
        </form>

        {passwordMsg && (
          <p className="text-[11px] text-slate-300">{passwordMsg}</p>
        )}
      </section>

      {/* === 2FA === */}
      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 py-5 shadow-lg space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Двухфакторная аутентификация
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Google Authenticator или Aegis.
            </p>
          </div>

          {profile?.twoFactorEnabled && (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full border border-emerald-400/70 bg-emerald-500/15 text-[11px] text-emerald-200">
                Уже включена
              </span>

              <button
                onClick={disable2FA}
                disabled={twoFaLoading}
                className="text-[11px] px-3 py-1.5 rounded-xl border border-red-500/60 text-red-200 bg-red-500/10 hover:bg-red-500/20 transition"
              >
                Отключить
              </button>
            </div>
          )}
        </div>

        {twoFaStep === "idle" && !profile?.twoFactorEnabled && (
          <button
            onClick={start2FA}
            disabled={twoFaLoading}
            className="px-4 py-2 rounded-2xl border border-white/60 bg-black/90 text-xs font-semibold text-slate-50 shadow-md hover:border-red-400 transition disabled:opacity-40"
          >
            {twoFaLoading ? "Подготовка..." : "Включить 2FA"}
          </button>
        )}

        {twoFaStep === "qr" && qr && (
          <div className="grid md:grid-cols-[auto,1fr] gap-4 items-center">
            <div className="flex flex-col items-center">
              <div className="rounded-2xl border border-white/10 bg-black/80 p-3">
                <img src={qr} alt="QR" className="w-48 h-48 rounded-xl" />
              </div>
              <span className="text-[11px] text-slate-500 mt-2">
                Сканируй в Authenticator
              </span>
            </div>

            <div className="space-y-3 text-xs text-slate-300">
              <p>1. Открой приложение Google Authenticator / Aegis.</p>
              <p>2. Добавь новый аккаунт сканировав QR.</p>

              <p className="text-[11px] text-slate-500">
                Если не сканируется — введи вручную:
                <br />
                <span className="text-slate-200 break-all">{secret}</span>
              </p>

              <button
                onClick={() => setTwoFaStep("confirm")}
                className="px-4 py-2 rounded-2xl border border-white/40 text-[11px] font-semibold text-slate-100 hover:bg-white/5 transition"
              >
                Далее — ввести код
              </button>
            </div>
          </div>
        )}

        {twoFaStep === "confirm" && (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">
              Введите 6-значный код:
            </p>

            <div className="flex gap-3">
              <input
                maxLength={6}
                value={twoFaCode}
                onChange={(e) =>
                  setTwoFaCode(e.target.value.replace(/\D/g, ""))
                }
                className="w-32 px-3 py-2 rounded-xl bg-black/60 border border-white/15 text-center text-lg tracking-widest text-slate-50 outline-none"
              />

              <button
                onClick={confirm2FA}
                disabled={twoFaLoading || twoFaCode.length < 6}
                className="px-4 py-2 rounded-2xl border border-white/60 bg-black/90 text-xs font-semibold shadow-md hover:border-green-400 transition disabled:opacity-40"
              >
                {twoFaLoading ? "Проверяем..." : "Подтвердить"}
              </button>
            </div>
          </div>
        )}

        {twoFaMsg && (
          <p className="text-[11px] text-emerald-400">{twoFaMsg}</p>
        )}
      </section>

      {loadingProfile && (
        <div className="text-[11px] text-slate-500">Загружаем профиль…</div>
      )}
    </div>
  );
}