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

type PunishmentType = "mute" | "ajail" | "warn" | "ban" | "hardban" | "gunban";

const TYPES: { value: PunishmentType; label: string }[] = [
  { value: "mute", label: "mute" },
  { value: "ajail", label: "ajail" },
  { value: "warn", label: "warn" },
  { value: "ban", label: "ban" },
  { value: "hardban", label: "hardban" },
  { value: "gunban", label: "gunban" },
];

type ValidationError = {
  lineIndex: number;
  message: string;
  line: string;
};

export default function PunishmentsPage() {
  const [loading, setLoading] = useState(true);
  const [lastComplaintCode, setLastComplaintCode] = useState("");
  const [punishments, setPunishments] = useState<Punishment[]>([]);

  const [commandsText, setCommandsText] = useState("");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );

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
  const [clearLoading, setClearLoading] = useState(false);


  function validateCommands(value: string) {
    const lines = value.split("\n");
    const errs: ValidationError[] = [];

    const mainCmdRe =
      /^\/(ajail|mute|ban|hardban|gunban)\s+(\d{3,9})\s+(\d{1,4})\s+Жалоба\s+(.+)$/i;

    const warnCmdRe = /^\/warn\s+(\d{3,9})\s+Жалоба\s+(.+)$/i;

    const noDurationRe =
      /^\/(ajail|mute|ban|hardban|gunban)\s+(\d{3,9})\s+Жалоба\b/i;

    lines.forEach((raw, idx) => {
      const line = raw.trim();
      if (!line) return;

      if (/^\/warn\b/i.test(line)) {
        if (!warnCmdRe.test(line)) {
          errs.push({
            lineIndex: idx,
            line,
            message:
              "Неверный формат /warn. Ожидается: /warn <staticId> Жалоба <код>",
          });
        }
        return;
      }

      if (/^\/(ajail|mute|ban|hardban|gunban)\b/i.test(line)) {
        if (mainCmdRe.test(line)) return;

        if (noDurationRe.test(line)) {
          errs.push({
            lineIndex: idx,
            line,
            message:
              "Для этого наказания требуется указать время (минуты/дни/часы).",
          });
        } else {
          errs.push({
            lineIndex: idx,
            line,
            message:
              "Неверный формат команды. Ожидается: /<тип> <staticId> <время> Жалоба <код>",
          });
        }
        return;
      }

      errs.push({
        lineIndex: idx,
        line,
        message: "Неизвестный тип команды.",
      });
    });

    setValidationErrors(errs);
  }


  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/punishments");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка загрузки");

        const list: Punishment[] = data.punishments ?? data ?? [];
        setPunishments(list);

        if (data.lastComplaintCode) {
          setLastComplaintCode(data.lastComplaintCode);
        }

        if (Array.isArray(data.commands)) {
          const text = data.commands.join("\n");
          setCommandsText(text);
          validateCommands(text);
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

    const normalizedComplaintCode = form.complaintCode.trim().toUpperCase();

    if (!form.staticId.trim() || !normalizedComplaintCode) {
      setError("Нужно указать Static ID и код жалобы.");
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await fetch("/api/punishments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          complaintCode: normalizedComplaintCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
      } else {
        const punishment: Punishment = data.punishment;
        const command: string = data.command;

        setPunishments((prev) => [punishment, ...prev].slice(0, 50));

        const newText = commandsText
          ? `${command}\n${commandsText}`
          : command;
        setCommandsText(newText);
        validateCommands(newText);

        setLastComplaintCode(normalizedComplaintCode);

        setForm({
          type: "ajail",
          staticId: "",
          duration: "",
          complaintCode: "",
        });
      }
    } catch (err) {
      console.error(err);
      setError("Сетевая ошибка");
    } finally {
      setSubmitLoading(false);
    }
  }


  function handleCommandsChange(value: string) {
    setCommandsText(value);
    validateCommands(value);
  }

  async function copyAll() {
    if (!commandsText.trim()) return;
    await navigator.clipboard.writeText(commandsText.trim());
  }

  async function clearCommands() {
    if (
      commandsText.trim().length > 0 &&
      !window.confirm(
        "Очистить список команд и пометить наказания как выданные?"
      )
    )
      return;

    setClearLoading(true);
    try {
      const res = await fetch("/api/punishments", { method: "DELETE" });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Ошибка очистки:", res.status, text);
      }

      setPunishments((prev) =>
        prev.map((p) => (p.issued ? p : { ...p, issued: true }))
      );

      setCommandsText("");
      setValidationErrors([]);
    } finally {
      setClearLoading(false);
    }
  }

  // =====================================================================
  // Рендер
  // =====================================================================

  if (loading) {
    return (
      <div className="text-sm text-slate-400">
        Загрузка панели наказаний...
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Наказания</h1>
        <p className="text-xs text-slate-400">
          Генерация и управление наказаниями.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[2.1fr,1.6fr]">

        <div className="space-y-4">

          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 px-5 py-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-red-200 mb-1">
              Последняя жалоба
            </div>
            <div className="text-sm font-medium text-red-100">
              {lastComplaintCode || "—"}
            </div>
          </div>

          {/* Форма */}
          <div className="rounded-3xl border border-white/8 bg-black/70 px-5 py-5 space-y-5">
            <h2 className="text-sm font-semibold">Выдача наказания</h2>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              {/* Тип */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-400">Тип наказания</label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      type: e.target.value as PunishmentType,
                    }))
                  }
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm"
                >
                  {TYPES.map((t) => (
                    <option key={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Static ID */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-400">Static ID</label>
                <input
                  value={form.staticId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, staticId: e.target.value }))
                  }
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm"
                />
              </div>

              {/* Duration */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-400">Время</label>
                <input
                  value={form.duration}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, duration: e.target.value }))
                  }
                  disabled={form.type === "warn"}
                  placeholder={form.type === "warn" ? "не требуется" : "30"}
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm disabled:opacity-40"
                />
              </div>

              {/* Complaint */}
              <div className="space-y-1.5 text-xs">
                <label className="text-slate-400">Жалоба</label>
                <input
                  value={form.complaintCode}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, complaintCode: e.target.value }))
                  }
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-sm"
                  placeholder="ANTI-0001"
                />
              </div>

              {error && (
                <div className="md:col-span-2 text-red-300 text-xs bg-red-500/10 border border-red-300/40 rounded-xl p-2">
                  {error}
                </div>
              )}

              <div className="md:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="px-5 py-2.5 rounded-2xl bg-black/80 border border-white/50"
                >
                  {submitLoading ? "Сохраняем..." : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>


        <div className="flex flex-col rounded-3xl border border-white/8 bg-black/70 px-5 py-5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold">Сгенерированные команды</h2>

            <div className="flex gap-2">
              <button
                onClick={copyAll}
                className="px-3 py-1.5 rounded-xl text-[11px] bg-black/80 border border-red-500/60"
              >
                Копировать всё
              </button>

              <button
                onClick={clearCommands}
                disabled={clearLoading}
                className="px-3 py-1.5 rounded-xl text-[11px] bg-black/80 border border-white/40"
              >
                {clearLoading ? "..." : "Очистить"}
              </button>
            </div>
          </div>

          {/* textarea */}
          <textarea
            className="mt-2 min-h-[260px] w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2.5 text-xs"
            value={commandsText}
            onChange={(e) => handleCommandsChange(e.target.value)}
            placeholder="Команды появятся здесь автоматически."
          />

          {validationErrors.length > 0 && (
            <div className="mt-2 text-red-300 text-[11px] space-y-1">
              {validationErrors.map((e, idx) => (
                <div key={idx}>
                  <b>Строка {e.lineIndex + 1}:</b> {e.message}
                  <br />
                  <code>{e.line}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>


      <div className="rounded-3xl border border-white/8 bg-black/70 px-5 py-5 text-xs">
        <h2 className="text-sm font-semibold mb-2">Последние наказания</h2>

        <table className="min-w-full border-separate border-spacing-y-1">
          <thead className="text-[10px] uppercase text-slate-500">
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
              <tr key={p.id} className="hover:bg-white/5">
                <td className="px-2 py-1">/{p.type}</td>
                <td className="px-2 py-1">{p.staticId}</td>
                <td className="px-2 py-1">
                  {p.type === "warn" ? "—" : p.duration}
                </td>
                <td className="px-2 py-1">{p.complaintCode}</td>
                <td className="px-2 py-1">
                  {p.issued ? (
                    <span className="border border-green-400 rounded-full px-2 py-0.5 text-green-300">
                      Да
                    </span>
                  ) : (
                    <span className="border border-slate-400 rounded-full px-2 py-0.5 text-slate-300">
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
                  Нет данных
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}