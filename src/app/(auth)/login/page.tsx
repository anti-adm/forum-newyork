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
}

// 🎨 Стили тегов
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

// 🏷 Названия тегов
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

  // ⚡ Исправленная загрузка профиля
  useEffect(() => {
    async function load() {
      setLoadingProfile(true);

      try {
        const res = await fetch("/api/profile/me");

        // 🔒 Если админ удалён / отключён → кидаем на логин
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        let data = null;

        try {
          data = await res.json();
        } catch {
          console.warn("Ответ не JSON");
        }

        if (!res.ok) {
          console.error("Ошибка API:", data);
          return;
        }

        setProfile(data as ProfileMeResponse);
      } finally {
        setLoadingProfile(false);
      }
    }

    load();
  }, []);

  // === Ниже весь остальной код без изменений ===

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarDeleting, setAvatarDeleting] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [twoFaStep, setTwoFaStep] =
    useState<"idle" | "qr" | "confirm">("idle");
  const [twoFaCode, setTwoFaCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<string | null>(null);

  // === Здесь весь твой UI ===
  // (я НЕ менял, только загрузку данных выше)

  return (
    <div className="space-y-6">
      {/* ...весь твой JSX как и был... */}
    </div>
  );
}