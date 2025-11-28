// src/app/(protected)/admin-stats/page.tsx
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

interface AdminUser {
  id: number;
  username: string;
}

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

export default async function AdminStatsPage() {
  const payload = await getAuthPayloadFromCookies();
  if (!payload || payload.role !== "SUPERADMIN") {
    redirect("/");
  }

  // берём только нужные поля, чтобы тип совпадал с AdminUser
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

  const stats = await Promise.all(
    admins.map(async (admin): Promise<{ admin: AdminUser; day: number; week: number; month: number }> => {
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
    })
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">Статистика админов</h1>
        <p className="text-xs text-slate-400">
          Доступно только супер-админам. Отслеживайте выполнение норм и активность состава.
        </p>
      </div>

      <div className="rounded-3xl border border-white/8 bg-black/70 backdrop-blur-xl px-5 md:px-6 py-5 shadow-[0_0_40px_rgba(0,0,0,0.9)] overflow-x-auto text-xs">
        <table className="min-w-full border-separate border-spacing-y-1">
          <thead className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
            <tr>
              <th className="text-left pr-4 pb-1">Админ</th>
              <th className="text-left pr-4 pb-1">Сегодня</th>
              <th className="text-left pr-4 pb-1">Неделя</th>
              <th className="text-left pr-4 pb-1">Месяц</th>
              <th className="text-left pb-1">Прогресс нормы</th>
            </tr>
          </thead>
          <tbody>
            {stats.map(({ admin, day, week, month }) => {
              const progress = dailyNorm > 0 ? Math.min(1, day / dailyNorm) : 0;

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
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-500 shadow-[0_0_14px_rgba(248,113,113,0.8)]"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                      <div className="text-[11px] text-slate-300 w-16 text-right">
                        {day}/{dailyNorm || 0}
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

      <div className="rounded-3xl border border-white/8 bg-black/60 backdrop-blur-xl px-5 md:px-6 py-4 shadow-[0_0_40px_rgba(0,0,0,0.9)] text-xs text-slate-400 space-y-1.5">
        <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-1">
          FAQ
        </div>
        <p>
          <span className="text-slate-200">Сегодня</span> — с 00:00 текущего дня.
        </p>
        <p>
          <span className="text-slate-200">Неделя</span> — с понедельника текущей недели.
        </p>
        <p>
          <span className="text-slate-200">Месяц</span> — с 1 числа текущего месяца.
        </p>
        <p>
          <span className="text-slate-200">Норма</span> — дневное количество жалоб,
          которое должен выполнить администратор. Изменяется в разделе{" "}
          <span className="text-red-300 font-medium">Настройки супер-админа</span>.
        </p>
      </div>
    </div>
  );
}