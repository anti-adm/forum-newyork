// src/app/(protected)/page.tsx
import { prisma } from "@/lib/prisma";
import { getAuthPayloadFromCookies } from "@/lib/auth";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export default async function DashboardPage() {
  const payload = await getAuthPayloadFromCookies();
  const adminId = payload?.userId ?? 0;

  const today = startOfToday();

    const [todayUniqueComplaints, settingDailyNorm, recentPunishments] =
    await Promise.all([
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
        take: 6,
      }),
    ]);

  const todayCount = todayUniqueComplaints.length;        // 🔥 вот здесь
  const dailyNorm = Number(settingDailyNorm?.value ?? 0);
  const progress = dailyNorm > 0 ? Math.min(1, todayCount / dailyNorm) : 0;

  return (
    <div className="space-y-6">
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

      {/* activity */}
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