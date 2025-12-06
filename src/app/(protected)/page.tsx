
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import Link from "next/link";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}



type ForumComplaintStatus = "open" | "in_review" | "request_84";

interface ForumComplaintItem {
  threadId: number;
  title: string;
  url: string;
  status: ForumComplaintStatus;
  complaintAuthor: string | null;
  complaintText: string | null;
  adminMark: null | {
    author: string;
    text: string;
  };
}

interface ForumComplaintsPayload {
  generatedAt: string;
  total: number;
  inReview: number;
  open: number;
  request84?: number; 
  items: ForumComplaintItem[];
}


async function loadActiveComplaints(): Promise<ForumComplaintsPayload | null> {
  try {
    const complaintsPath = path.join(
      process.cwd(),
      "public",
      "forum-data",
      "active-complaints.json"
    );
    const raw = await fs.readFile(complaintsPath, "utf8");
    const data = JSON.parse(raw) as ForumComplaintsPayload;

    if (!Array.isArray(data.items)) return null;
    return data;
  } catch {
    return null;
  }
}

// Настройки бейджа статуса
function getStatusConfig(status: ForumComplaintStatus) {
  switch (status) {
    case "open":
      return {
        label: "Открыта",
        classes:
          "border-emerald-400/70 bg-emerald-500/10 text-emerald-200",
      };
    case "in_review":
      return {
        label: "На рассмотрении",
        classes: "border-amber-400/70 bg-amber-500/10 text-amber-200",
      };
    case "request_84":
      return {
        label: "8.4 ПГО",
        classes: "border-pink-400/80 bg-pink-500/15 text-pink-200",
      };
    default:
      return {
        label: "Открыта",
        classes:
          "border-emerald-400/70 bg-emerald-500/10 text-emerald-200",
      };
  }
}

export default async function DashboardPage() {
  const payload = await getAuthPayloadFromCookies();
  const adminId = payload?.userId ?? 0;

  const today = startOfToday();

  const [
    todayUniqueComplaints,
    settingDailyNorm,
    recentPunishments,
    forumComplaints,
  ] = await Promise.all([
    prisma.punishment.findMany({
      where: {
        adminId,
        createdAt: { gte: today },
      },
      distinct: ["complaintCode"],
      select: { complaintCode: true },
    }),
    prisma.setting.findUnique({ where: { key: "daily_norm" } }),
    prisma.punishment.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 8, // показываем только 8 последних логов
    }),
    loadActiveComplaints(),
  ]);

  const todayCount = todayUniqueComplaints.length;
  const dailyNorm = Number(settingDailyNorm?.value ?? 0);
  const progress = dailyNorm > 0 ? Math.min(1, todayCount / dailyNorm) : 0;

  // данные по форумным жалобам
  const forumTotal = forumComplaints?.total ?? 0;
  const forumInReview = forumComplaints?.inReview ?? 0;
  const forumOpen = forumComplaints?.open ?? 0;
  const forumItems = forumComplaints?.items ?? [];

  const forumRequest84 =
    forumComplaints?.request84 ??
    forumItems.filter((i) => i.status === "request_84").length;

  // Показываем самые старые жалобы первыми
  const forumOldestFirst = [...forumItems].reverse();
  const forumTop = forumOldestFirst.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* приветствие */}
      <div>
        <h1 className="text-2xl font-semibold mb-1">
          Привет,{" "}
          <span className="text-red-300">
            {payload?.username ?? "админ"}
          </span>
        </h1>
        <p className="text-xs text-slate-400">
          Следи за своей активностью и дневной нормой форумных жалоб.
        </p>
      </div>

      {/* top stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Сегодняшние жалобы" value={todayCount} />
        <StatCard label="Дневная норма" value={dailyNorm} />

        <div className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl px-5 py-4 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
              Прогресс нормы
            </span>
            <span className="text-xs text-slate-300">
              {todayCount}/{dailyNorm}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-red-500 shadow-[0_0_18px_rgba(248,113,113,0.8)]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </div>
      </div>


      <div className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <h2 className="text-sm font-semibold mb-1.5 flex items-center gap-2">
          Активность за сегодня
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-500/40 text-red-200 bg-red-500/10">
            live
          </span>
        </h2>
        <p className="text-xs text-slate-400">
          Осталось{" "}
          <span className="text-red-300 font-medium">
            {Math.max(0, dailyNorm - todayCount)}
          </span>{" "}
          жалоб до выполнения нормы.
        </p>
      </div>


      {forumComplaints && (
        <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-6 py-4 shadow-[0_0_30px_rgba(0,0,0,0.9)] space-y-3">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div>
              <h2 className="text-sm font-semibold text-slate-50">
                Актуальные жалобы с форума
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Актуальные жалобы раздела{" "}
                <span className="text-red-300 font-medium">
                  “Жалобы на игроков”
                </span>{" "}
                по серверу Seattle. Вверху{" "}
                <span className="text-slate-100 font-semibold">
                  самые старые
                </span>{" "}
                жалобы, их нужно закрывать в первую очередь.
              </p>
            </div>

            <div className="text-right text-[11px] text-slate-400 space-y-0.5">
              <div>
                Всего:{" "}
                <span className="text-slate-100 font-medium">
                  {forumTotal}
                </span>
              </div>
              <div>
                На рассмотрении:{" "}
                <span className="text-amber-300 font-medium">
                  {forumInReview}
                </span>
              </div>
              <div>
                Открыты:{" "}
                <span className="text-emerald-300 font-medium">
                  {forumOpen}
                </span>
              </div>
              <div>
                8.4 ПГО:{" "}
                <span className="text-pink-300 font-medium">
                  {forumRequest84}
                </span>
              </div>
            </div>
          </div>

          {forumTop.length === 0 ? (
            <p className="text-xs text-slate-500">
              Актуальных жалоб сейчас нет или данные ещё не были загружены
              ботом.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {forumTop.map((item) => {
                const { label, classes } = getStatusConfig(item.status);

                return (
                  <Link
                    key={item.threadId}
                    href={item.url}
                    target="_blank"
                    className="group block rounded-2xl border border-white/8 bg-black/50 px-4 py-3 hover:border-red-400/70 hover:bg-black/70 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">

                      <div className="flex-1 min-w-0">
                        <div className="text-slate-100 font-medium truncate group-hover:text-red-300 transition-colors">
                          {item.title}
                        </div>
                        <div className="mt-1 text-[11px] text-slate-500 line-clamp-2">
                          {item.complaintAuthor && (
                            <span className="text-slate-300">
                              {item.complaintAuthor}:{" "}
                            </span>
                          )}
                          {item.complaintText ||
                            "Текст жалобы не найден."}
                        </div>
                      </div>

                      {/* Правая часть: статус + (опционально) ответ администратора */}
                      <div className="md:w-64 text-[11px] text-slate-400 border-t md:border-t-0 md:border-l border-white/10 md:pl-3 md:ml-3 pt-2 md:pt-0 flex flex-col items-start md:items-end gap-1">
                        <span
                          className={
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border " +
                            classes
                          }
                        >
                          {label}
                        </span>

                        {item.adminMark && (
                          <div className="w-full md:text-right">
                            <div className="text-slate-500 mb-0.5">
                              Ответ:{" "}
                              <span className="text-slate-200">
                                {item.adminMark.author}
                              </span>
                            </div>
                            <div className="line-clamp-3">
                              {item.adminMark.text}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Кнопка ко всем жалобам */}
          <div className="flex justify-end pt-1">
            <Link
              href="/forum-complaints"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-2xl border border-red-400/70 text-[11px] md:text-sm text-red-100 hover:bg-red-500/15 hover:text-red-50 transition-colors"
            >
              Смотреть все актуальные жалобы
              <span className="text-base leading-none">→</span>
            </Link>
          </div>
        </section>
      )}

      {/* recent punishments */}
      <div className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Последние жалобы</h2>
          <span className="text-[11px] text-slate-500">
            последние {recentPunishments.length} записей
          </span>
        </div>

        <div className="overflow-x-auto text-xs">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="text-left pr-4 pb-1">Тип</th>
                <th className="text-left pr-4 pb-1">Static ID</th>
                <th className="text-left pr-4 pb-1">Длительность</th>
                <th className="text-left pr-4 pb-1">Жалоба</th>
                <th className="text-left pb-1">Время</th>
              </tr>
            </thead>

            <tbody>
              {recentPunishments.map((p) => (
                <tr key={p.id}>
                  <td className="pr-4">
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/40 text-[11px] text-red-200">
                      /{p.type}
                    </span>
                  </td>

                  <td className="pr-4 text-slate-200">{p.staticId}</td>

                  <td className="pr-4 text-slate-300">
                    {p.duration > 0 ? `${p.duration} ` : "—"}
                  </td>

                  <td className="pr-4 text-slate-300">{p.complaintCode}</td>

                  <td className="text-slate-400 text-[11px]">
                    {new Date(p.createdAt).toLocaleTimeString("ru-RU")}
                  </td>
                </tr>
              ))}

              {!recentPunishments.length && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center text-slate-500 text-xs py-3"
                  >
                    Наказаний пока не было.
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl px-5 py-4 shadow-[0_0_40px_rgba(0,0,0,0.9)]">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400 mb-1.5">
        {label}
      </div>
      <div className="text-2xl font-semibold mb-1 text-red-200">{value}</div>
    </div>
  );
}