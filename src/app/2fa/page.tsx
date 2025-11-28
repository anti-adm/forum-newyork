// src/app/2fa/page.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function TwoFAPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tempToken = searchParams.get("token") || "";

  const [code, setCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!tempToken) {
    // если пришли без токена
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-300">
        Нет активной сессии 2FA. Попробуйте войти снова.
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("Введите код из приложения-аутентификатора");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          tempToken,
          trustDevice,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Неверный код, попробуйте ещё раз");
        return;
      }

      // успех — идём в панель
      router.replace("/");
    } catch (err) {
      console.error(err);
      setError("Ошибка сети, попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-black/70 px-6 py-6 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
        <h1 className="mb-2 text-lg font-semibold text-slate-50">
          Подтверждение входа
        </h1>
        <p className="mb-5 text-xs text-slate-400">
          Введите 6-значный код из приложения-аутентификатора, чтобы завершить
          вход в панель.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5 text-xs">
            <label className="block text-slate-400">Код подтверждения</label>
            <input
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))
              }
              className="w-full rounded-xl bg-black/60 border border-white/12 px-3 py-2.5 text-sm text-slate-50 outline-none tracking-[0.3em] text-center font-mono focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
              placeholder="••••••"
            />
          </div>

          <label className="flex items-center gap-2 text-[11px] text-slate-400">
            <input
              type="checkbox"
              checked={trustDevice}
              onChange={(e) => setTrustDevice(e.target.checked)}
              className="h-3.5 w-3.5 rounded border border-white/30 bg-black/60"
            />
            Запомнить это устройство на 30 дней
          </label>

          {error && (
            <div className="rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex w-full items-center justify-center rounded-2xl border border-white/60 bg-black/85 px-4 py-2.5 text-sm font-semibold text-slate-50 shadow-[0_0_18px_rgba(248,113,113,0.7)] hover:border-red-400 hover:bg-black/95 hover:shadow-[0_0_26px_rgba(248,113,113,0.9)] transition disabled:opacity-60 disabled:shadow-none"
          >
            {loading ? "Проверяем..." : "Подтвердить вход"}
          </button>
        </form>
      </div>
    </div>
  );
}