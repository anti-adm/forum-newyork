// src/app/login/page.tsx
"use client";

import { useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [step, setStep] = useState<"login" | "2fa">("login");
  const [tempToken, setTempToken] = useState<string>("");
  const [twofaCode, setTwofaCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // ---------- LOGIN ----------
  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (!username || !password || loading) return;

    setLoading(true);
    setErr("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErr(data.error || "Ошибка входа");
        return;
      }

      // --- требует 2FA ---
      if (data.needs2fa) {
        setTempToken(data.tempToken);
        setStep("2fa");
        setTwofaCode("");
        return;
      }

      // --- обычный вход ---
      window.location.href = "/"; // 👈 чтобы точно отработал middleware
    } catch (e) {
      setErr("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  }

  // ---------- 2FA VERIFY ----------
  async function verify2fa(e?: React.FormEvent) {
    e?.preventDefault();
    if (!twofaCode || loading || twofaCode.length !== 6) return;

    setLoading(true);
    setErr("");

    try {
      const res = await fetch("/api/auth/2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tempToken,
          code: twofaCode,
          trustDevice: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErr(data.error || "Код неверный");
        return;
      }

      window.location.href = "/"; // 👈 после успешной 2FA тоже полный переход
    } catch (e) {
      setErr("Не удалось подключиться к серверу");
    } finally {
      setLoading(false);
    }
  }

  const onSubmit =
    step === "login"
      ? (e: React.FormEvent) => handleLogin(e)
      : (e: React.FormEvent) => verify2fa(e);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-50">
      {/* основной блок логина */}
      <div className="relative w-full max-w-[520px] mx-4">
        <form
          onSubmit={onSubmit}
          className="relative rounded-[32px] border border-white/10 bg-black/75 backdrop-blur-xl px-8 md:px-10 py-8 md:py-10 shadow-[0_0_60px_rgba(0,0,0,0.9)] space-y-6"
        >
          {/* заголовок */}
          <div className="text-center space-y-1">
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              {step === "login" ? "FORUM ADMIN" : "Подтверждение входа"}
            </h1>
            <p className="text-xs md:text-sm text-slate-400">
              {step === "login"
                ? "Вход в ADMIN-Панель"
                : "Введите 6-значный код из приложения аутентификации."}
            </p>
          </div>

          {/* ошибка */}
          {err && (
            <div className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/40 rounded-2xl px-3 py-2">
              {err}
            </div>
          )}

          {/* шаг 1: логин/пароль */}
          {step === "login" && (
            <div className="space-y-4">
              <div className="space-y-1 text-xs">
                <label className="block text-slate-400">Логин</label>
                <input
                  placeholder="admin"
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                />
              </div>

              <div className="space-y-1 text-xs">
                <label className="block text-slate-400">Пароль</label>
                <input
                  placeholder="••••••••"
                  type="password"
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>
          )}

          {/* шаг 2: 2FA */}
          {step === "2fa" && (
            <div className="space-y-4">
              <div className="space-y-1 text-xs">
                <label className="block text-slate-400">
                  6-значный код из приложения
                </label>
                <input
                  maxLength={6}
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-center text-lg tracking-[0.35em] outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500/40"
                  value={twofaCode}
                  onChange={(e) =>
                    setTwofaCode(e.target.value.replace(/\D/g, ""))
                  }
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Открой Google Authenticator, Aegis или другое приложение 2FA
                  и введи текущий код.
                </p>
              </div>
            </div>
          )}

          {/* кнопка */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                loading ||
                (step === "login" && (!username || !password)) ||
                (step === "2fa" && twofaCode.length !== 6)
              }
              className="
                w-full inline-flex items-center justify-center
                rounded-2xl px-4 py-2.5 text-sm font-semibold
                bg-gradient-to-r from-red-500 via-pink-500 to-red-500
                shadow-[0_0_32px_rgba(248,113,113,0.8)]
                hover:shadow-[0_0_40px_rgba(248,113,113,1)]
                transition disabled:opacity-60 disabled:shadow-none
              "
            >
              {loading
                ? step === "login"
                  ? "Входим..."
                  : "Проверяем..."
                : step === "login"
                ? "Войти"
                : "Подтвердить 2FA"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}