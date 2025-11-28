// src/app/(protected)/punishments/page.tsx
"use client";

import { useEffect, useState } from "react";

type Punishment = {
  id: number;
  type: string;
  staticId: number;
  duration: number;
  durationUnit?: string;
  complaintCode: string;
  issued: boolean;
  command?: string;
  createdAt?: string;
};

type PunishmentType = "mute" | "ajail" | "warn" | "ban" | "hardban";

const TYPES: { value: PunishmentType; label: string }[] = [
  { value: "mute", label: "mute" },
  { value: "ajail", label: "ajail" },
  { value: "warn", label: "warn" },
  { value: "ban", label: "ban" },
  { value: "hardban", label: "hard Ban" },
];

export default function PunishmentsPage() {
  const [loading, setLoading] = useState(true);
  const [lastComplaintCode, setLastComplaintCode] = useState("");
  const [punishments, setPunishments] = useState<Punishment[]>([]);
  const [commands, setCommands] = useState<string[]>([]);

  const [form, setForm] = useState<{
    type: PunishmentType;
    staticId: string;
    duration: string;
    complaintCode: string;
  }>({
    type: "ajail",
    staticId: "",
    duration: "",
    complaintCode: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/punishments");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");

        const list: Punishment[] = data.punishments ?? data ?? [];
        setPunishments(list);
        setCommands(
          (list || [])
            .map((p) => p.command)
            .filter((c): c is string => Boolean(c))
        );
        if (data.lastComplaintCode) {
          setLastComplaintCode(data.lastComplaintCode);
        }
      } catch (err) {
        console.error(err);
        setError("Не удалось загрузить наказания");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.staticId.trim() || !form.complaintCode.trim()) {
      setError("Нужно указать Static ID и код жалобы");
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch("/api/punishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
      } else {
        const punishment: Punishment = data.punishment;
        const command: string = data.command;

        setPunishments((prev) => [punishment, ...prev].slice(0, 50));
        setCommands((prev) => [command, ...prev].slice(0, 50));
        setLastComplaintCode(form.complaintCode);

        setForm((prev) => ({
          ...prev,
          staticId: "",
          duration: "",
          complaintCode: "",
        }));
      }
    } catch (err) {
      console.error(err);
      setError("Сетевая ошибка");
    } finally {
      setSubmitLoading(false);
    }
  }

  function handleCommandsChange(value: string) {
    setCommands(value.split("\n"));
  }

  async function copyAll() {
    if (!commands.length) return;
    try {
      await navigator.clipboard.writeText(commands.join("\n"));
    } catch (err) {
      console.error(err);
      alert("Не удалось скопировать команды");
    }
  }

  function clearCommands() {
    setCommands([]);
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-400">
        Загрузка панели наказаний...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-slate-50">Наказания</h1>
        <p className="text-xs text-slate-400">
          Генерируй и сохраняй команды наказаний в одном месте. Панель
          адаптирована под работу с форумными жалобами.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2.1fr,1.6fr]">
        {/* Левая колонка */}
        <div className="space-y-4">
          {/* Последняя жалоба */}
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-5 py-4 backdrop-blur-xl shadow-[0_0_40px_rgba(0,0,0,0.9)]">
            <div className="text-[11px] uppercase tracking-[0.18em] text-red-200 mb-1.5">
              Последняя жалоба
            </div>
            <div className="text-sm font-medium text-red-100">
              {lastComplaintCode || "—"}
            </div>
          </div>

          {/* Форма выдачи наказания */}
          <div className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-5">
            <div>
              <h2 className="text-sm font-semibold mb-1 text-slate-50">
                Выдача наказания
              </h2>
              <p className="text-[11px] text-slate-500">
                Сформируй корректную команду прямо из панели.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="grid gap-4 md:grid-cols-2 md:gap-5"
            >
              {/* Тип наказания */}
              <div className="space-y-1.5 text-xs">
                <label className="block text-slate-400">Тип наказания</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as PunishmentType,
                    }))
                  }
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-slate-50 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40 transition"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* staticId */}
              <div className="space-y-1.5 text-xs">
                <label className="block text-slate-400">Static ID</label>
                <input
                  value={form.staticId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staticId: e.target.value }))
                  }
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-slate-50 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                  placeholder="12345"
                />
              </div>

              {/* duration */}
              <div className="space-y-1.5 text-xs">
                <label className="block text-slate-400">Длительность (мин)</label>
                <input
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration: e.target.value }))
                  }
                  disabled={form.type === "warn"}
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-slate-50 outline-none disabled:opacity-40 focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                  placeholder={
                    form.type === "warn"
                      ? "для warn не требуется"
                      : "например, 30"
                  }
                />
              </div>

              {/* complaint code */}
              <div className="space-y-1.5 text-xs">
                <label className="block text-slate-400">Код жалобы</label>
                <input
                  value={form.complaintCode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      complaintCode: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm text-slate-50 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                  placeholder="ANTI-0001"
                />
              </div>

              {error && (
                <div className="md:col-span-2 rounded-xl border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </div>
              )}

              <div className="md:col-span-2 flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-2.5 text-sm font-semibold
                            bg-black/85 border border-white/70 text-slate-50
                            shadow-[0_0_14px_rgba(248,113,113,0.45)]
                            hover:border-red-400 hover:shadow-[0_0_24px_rgba(248,113,113,0.9)]
                            hover:bg-black/95 transition
                            disabled:opacity-50 disabled:shadow-none disabled:hover:border-white/40"
                >
                  {submitLoading ? "Сохраняем..." : "Сгенерировать и сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Правая колонка — команды */}
        <div className="space-y-4">
          <div className="flex h-full flex-col rounded-3xl border border-white/8 bg-black/70 px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-50">
                Сгенерированные команды
              </p>
              <div className="flex gap-2">
                <button
                  onClick={copyAll}
                  className="inline-flex items-center rounded-xl px-3 py-1.5 text-[11px] font-semibold
                            bg-black/80 border border-red-500/60 text-red-100
                            shadow-[0_0_12px_rgba(248,113,113,0.55)]
                            hover:bg-black hover:border-red-400 hover:shadow-[0_0_20px_rgba(248,113,113,0.9)]
                            transition"
                >
                  Копировать все
                </button>
                <button
                  onClick={clearCommands}
                  className="inline-flex items-center rounded-xl px-3 py-1.5 text-[11px]
                            bg-black/80 border border-white/50 text-slate-200
                            hover:bg-black hover:border-red-300 hover:text-red-100
                            transition"
                >
                  Очистить список
                </button>
              </div>
            </div>

                <textarea
                  className="mt-2 min-h-[260px] w-full flex-1 rounded-xl border border-white/10 bg-black/70 px-3 py-2.5
                            text-xs text-slate-50 outline-none
                            focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
                  value={commands.join("\n")}
                  onChange={(e) => handleCommandsChange(e.target.value)}
                  placeholder="Команды можно подкорректировать вручную перед копированием."
                />
            <p className="mt-2 text-[11px] text-slate-500">
            
            </p>
          </div>
        </div>
      </div>

      {/* Таблица наказаний */}
      <div className="rounded-3xl border border-white/8 bg-black/70 px-5 md:px-6 py-5 text-xs text-slate-300 shadow-[0_0_40px_rgba(0,0,0,0.9)] backdrop-blur-xl">
        <p className="mb-3 text-sm font-semibold text-slate-50">
          Последние наказания
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-2 py-1 text-left">Тип</th>
                <th className="px-2 py-1 text-left">Static ID</th>
                <th className="px-2 py-1 text-left">Время</th>
                <th className="px-2 py-1 text-left">Жалоба</th>
                <th className="px-2 py-1 text-left">Выдано</th>
              </tr>
            </thead>
            <tbody>
              {punishments.map((p) => (
                <tr
                  key={p.id}
                  className="bg-black/80 transition-colors hover:bg-black"
                >
                  <td className="px-2 py-1">
                    <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 font-mono text-[11px] text-red-200">
                      /{p.type}
                    </span>
                  </td>
                  <td className="px-2 py-1 text-slate-100">{p.staticId}</td>
                  <td className="px-2 py-1 text-slate-100">
                    {p.type === "warn" ? "—" : `${p.duration} мин`}
                  </td>
                  <td className="px-2 py-1 text-slate-100">
                    {p.complaintCode}
                  </td>
                  <td className="px-2 py-1">
                    {p.issued ? (
                      <span className="rounded-full border border-slate-200 bg-slate-100/10 px-2 py-0.5 text-[11px] text-slate-50">
                        Да
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-slate-500 bg-black/70 px-2 py-0.5 text-[11px] text-slate-200">
                        Нет
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {punishments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-2 py-3 text-center text-slate-500"
                  >
                    Нет сохранённых наказаний
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}