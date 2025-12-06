
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

interface AdminUser {
  id: number;
  username: string;
}

// ===== helpers по времени =====

function startOfDay(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // понедельник
  d.setDate(d.getDate() - day);
  return startOfDay(d);
}

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  return startOfDay(d);
}

function formatYMD(d: Date) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function parseYMD(value?: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function endOfDay(d: Date) {
  const date = new Date(d);
  date.setHours(23, 59, 59, 999);
  return date;
}

export default async function AdminStatsPage(props: {
  searchParams: Promise<{ sort?: string; from?: string; to?: string }>;
}) {
  const payload = await getAuthPayloadFromCookies();
  if (!payload || payload.role !== "SUPERADMIN") {
    redirect("/");
  }


  const searchParams = await props.searchParams;

  // --- sort tab: day / week / month ---
  const sortRaw = searchParams?.sort;
  const sortBy: "day" | "week" | "month" =
    sortRaw === "week" || sortRaw === "month" ? sortRaw : "day";


  const [admins, dailyNormSetting] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: {
        id: true,
        username: true,
      },
    }),
    prisma.setting.findUnique({ where: { key: "daily_norm" } }),
  ]);

  const dailyNorm = Number(dailyNormSetting?.value ?? 0);

  const [dayStart, weekStart, monthStart] = [
    startOfDay(),
    startOfWeek(),
    startOfMonth(),
  ];


  const statsRaw = await Promise.all(
    admins.map(
      async (
        admin
      ): Promise<{
        admin: AdminUser;
        day: number;
        week: number;
        month: number;
      }> => {
        const [dayRows, weekRows, monthRows] = await Promise.all([
          prisma.punishment.findMany({
            where: { adminId: admin.id, createdAt: { gte: dayStart } },
            distinct: ["complaintCode"],
            select: { complaintCode: true },
          }),
          prisma.punishment.findMany({
            where: { adminId: admin.id, createdAt: { gte: weekStart } },
            distinct: ["complaintCode"],
            select: { complaintCode: true },
          }),
          prisma.punishment.findMany({
            where: { adminId: admin.id, createdAt: { gte: monthStart } },
            distinct: ["complaintCode"],
            select: { complaintCode: true },
          }),
        ]);

        const day = dayRows.length;
        const week = weekRows.length;
        const month = monthRows.length;

        return { admin, day, week, month };
      }
    )
  );


  const stats = [...statsRaw].sort((a, b) => {
    if (sortBy === "week") return b.week - a.week;
    if (sortBy === "month") return b.month - a.month;
    return b.day - a.day;
  });



  const defaultFrom = startOfMonth();
  const defaultTo = startOfDay();

  const fromStr = searchParams?.from || formatYMD(defaultFrom);
  const toStr = searchParams?.to || formatYMD(defaultTo);

  const fromDate = parseYMD(fromStr) ?? defaultFrom;
  const toDate = parseYMD(toStr) ?? defaultTo;

  const rangeStatsRaw = await Promise.all(
    admins.map(async (admin) => {
      const rows = await prisma.punishment.findMany({
        where: {
          adminId: admin.id,
          createdAt: {
            gte: startOfDay(fromDate),
            lte: endOfDay(toDate),
          },
        },
        distinct: ["complaintCode"],
        select: { complaintCode: true },
      });

      return {
        admin,
        count: rows.length,
      };
    })
  );

  const rangeStats = [...rangeStatsRaw].sort(
    (a, b) => b.count - a.count || a.admin.username.localeCompare(b.admin.username)
  );


  const progressLabel =
    sortBy === "week"
      ? "Прогресс нормы — неделя"
      : sortBy === "month"
      ? "Прогресс нормы — месяц"
      : "Прогресс нормы — день";

  const weeklyTarget = dailyNorm * 7;
  const monthlyTarget = dailyNorm * 30;

  return (
    <div className="space-y-6">

      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-xl font-semibold">Статистика админов</h1>
          <p className="text-xs text-slate-400">
            Отслеживание выполнения норм и активности состава.
          </p>
        </div>

        <div className="flex gap-3 text-xs">
          {[
            { key: "day" as const, label: "Сегодня" },
            { key: "week" as const, label: "Неделя" },
            { key: "month" as const, label: "Месяц" },
          ].map((item) => (
            <Link
              key={item.key}
              href={`?sort=${item.key}&from=${fromStr}&to=${toStr}`}
              prefetch={false}
              className={`px-3 py-1.5 rounded-xl border transition ${
                sortBy === item.key
                  ? "border-red-400 bg-red-500/15 text-red-200 shadow-[0_0_12px_rgba(248,113,113,0.7)]"
                  : "border-white/20 bg-white/5 text-slate-300 hover:border-red-400 hover:text-red-200"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* ОСНОВНАЯ ТАБЛИЦА */}
      <div className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-x-auto text-xs">
        <table className="min-w-full border-separate border-spacing-y-1">
          <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="text-left pr-4 pb-1">Админ</th>
              <th className="text-left pr-4 pb-1">Сегодня</th>
              <th className="text-left pr-4 pb-1">Неделя</th>
              <th className="text-left pr-4 pb-1">Месяц</th>
              <th className="text-left pb-1">{progressLabel}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ admin, day, week, month }) => {
              let current = day;
              let target = dailyNorm;

              if (sortBy === "week") {
                current = week;
                target = weeklyTarget;
              } else if (sortBy === "month") {
                current = month;
                target = monthlyTarget;
              }

              const progress = target > 0 ? Math.min(1, current / target) : 0;

              return (
                <tr key={admin.id}>
                  <td className="pr-4">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-100 text-xs">
                        {admin.username}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        ID: {admin.id}
                      </span>
                    </div>
                  </td>
                  <td className="pr-4 text-slate-200">{day}</td>
                  <td className="pr-4 text-slate-200">{week}</td>
                  <td className="pr-4 text-slate-200">{month}</td>
                  <td className="pr-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red-500 shadow-[0_0_14px_rgba(248,113,113,0.8)]"
                            style={{ width: `${progress * 100}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-300 w-20 text-right">
                          {current}/{target || 0}
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {stats.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-slate-500 py-3 text-xs"
                >
                  Активных администраторов не найдено.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>


      <section className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] space-y-4 text-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-50">
              Статистика по диапазону дат
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Выбери период, чтобы посмотреть, сколько форумных жалоб
              обработал каждый администратор.
            </p>
          </div>

          <form
            method="GET"
            className="flex flex-wrap items-end gap-3 text-[11px]"
          >

            <input type="hidden" name="sort" value={sortBy} />
            <div className="flex flex-col gap-1">
              <label className="text-slate-400">С даты</label>
              <input
                key={fromStr}
                type="date"
                name="from"
                defaultValue={fromStr}
                className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-slate-400">По дату</label>
              <input
                key={toStr}
                type="date"
                name="to"
                defaultValue={toStr}
                className="rounded-xl bg-black/60 border border-white/10 px-3 py-2 outline-none focus:border-red-400 focus:ring-1 focus:ring-red-500/40"
              />
            </div>
            <button
              type="submit"
              className="h-[38px] px-4 rounded-2xl bg-black/85 border border-white/60 text-slate-50 font-semibold shadow-[0_0_14px_rgba(248,113,113,0.45)] hover:bg-black/95 hover:border-red-400 hover:shadow-[0_0_24px_rgba(248,113,113,0.9)] transition"
            >
              Показать
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-1">
            <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="text-left pr-4 pb-1">Админ</th>
                <th className="text-left pb-1">
                  Жалоб в период {fromStr} — {toStr}
                </th>
              </tr>
            </thead>
            <tbody>
              {rangeStats.map(({ admin, count }) => (
                <tr key={admin.id}>
                  <td className="pr-4">
                    <span className="font-medium text-slate-100 text-xs">
                      {admin.username}
                    </span>
                  </td>
                  <td className="text-slate-200">{count}</td>
                </tr>
              ))}

              {rangeStats.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    className="text-center text-slate-500 text-xs py-3"
                  >
                    Данных за выбранный период нет.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <div className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl px-5 md:px-6 py-4 shadow-[0_0_40px_rgba(0,0,0,0.9)] text-xs text-slate-400 space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-1">
          FAQ
        </div>
        <p>
          <span className="text-slate-200">Сегодня</span> — с 00:00 текущего дня.
        </p>
        <p>
          <span className="text-slate-200">Неделя</span> — с понедельника
          текущей недели.
        </p>
        <p>
          <span className="text-slate-200">Месяц</span> — с 1 числа текущего
          месяца.
        </p>
        <p>
          <span className="text-slate-200">Дневная норма</span> — значение,
          заданное в настройках супер-админа.
        </p>
        <p>
          <span className="text-slate-200">Недельная норма</span> считается
          как <span className="text-slate-200">дневная норма × 7</span>,{" "}
          <span className="text-slate-200">месячная</span> — как{" "}
          <span className="text-slate-200">дневная норма × 30</span>.
        </p>
      </div>
    </div>
  );
}