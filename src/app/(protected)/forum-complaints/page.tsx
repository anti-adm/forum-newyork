
import fs from "fs/promises";
import path from "path";
import Link from "next/link";

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


async function loadComplaints(): Promise<ForumComplaintsPayload | null> {
  try {
    const filepath = path.join(
      process.cwd(),
      "public",
      "forum-data",
      "active-complaints.json"
    );
    const raw = await fs.readFile(filepath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Настройки для бейджа статуса
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
        classes:
          "border-amber-400/70 bg-amber-500/10 text-amber-200",
      };
    case "request_84":
      return {
        label: "8.4 ПГО",
        classes:
          "border-pink-400/80 bg-pink-500/15 text-pink-200",
      };
    default:
      return {
        label: "Открыта",
        classes:
          "border-emerald-400/70 bg-emerald-500/10 text-emerald-200",
      };
  }
}

export default async function ForumComplaintsPage(props: {
  searchParams: Promise<{ page?: string; status?: string; sort?: string }>;
}) {
  const searchParams = await props.searchParams;
  const data = await loadComplaints();

  if (!data) {
    return (
      <div className="p-6 text-slate-400">
        Данные с форума пока отсутствуют. Ожидаем первое сканирование ботом.
      </div>
    );
  }

  // общая стата
  const totalAll = data.total;
  const totalInReview = data.inReview;
  const totalOpen = data.open;

  const totalRequest84 =
    typeof data.request84 === "number"
      ? data.request84
      : data.items.filter((i) => i.status === "request_84").length;

  // ======= ФИЛЬТРЫ =======
  const statusFilter = (searchParams.status ?? "all") as
    | "all"
    | "open"
    | "in_review"
    | "request_84";

  const sort = (searchParams.sort ?? "new") as "new" | "old";

  let filtered = [...data.items];

  if (statusFilter !== "all") {
    filtered = filtered.filter((it) => it.status === statusFilter);
  }

  // ======= СОРТИРОВКА =======
  if (sort === "new") {
    filtered.sort((a, b) => b.threadId - a.threadId); // новые сверху
  } else {
    filtered.sort((a, b) => a.threadId - b.threadId); // старые сверху
  }

  // ======= ПАГИНАЦИЯ =======
  const page = Number(searchParams.page ?? "1");
  const perPage = 8;

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(Math.max(1, page), totalPages);

  const start = (currentPage - 1) * perPage;
  const pageItems = filtered.slice(start, start + perPage);

  // генератор ссылок с сохранением фильтров
  function buildUrl({
    page,
    status = statusFilter,
    sortBy = sort,
  }: {
    page: number;
    status?: string;
    sortBy?: string;
  }) {
    return `/forum-complaints?status=${status}&sort=${sortBy}&page=${page}`;
  }

  return (
    <div className="p-6 space-y-6">
      {/* header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold text-slate-100 mb-1">
            Все актуальные жалобы
          </h1>
          <p className="text-xs text-slate-400">
            Отфильтруй жалобы по статусу и обрабатывай сначала старые — они
            важнее.
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right text-[11px] text-slate-400 space-y-0.5">
            <div>
              Всего:{" "}
              <span className="text-slate-100 font-medium">{totalAll}</span>
            </div>
            <div>
              На рассмотрении:{" "}
              <span className="text-amber-300 font-medium">
                {totalInReview}
              </span>
            </div>
            <div>
              Открыты:{" "}
              <span className="text-emerald-300 font-medium">
                {totalOpen}
              </span>
            </div>
            <div>
              8.4 ПГО:{" "}
              <span className="text-pink-300 font-medium">
                {totalRequest84}
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="text-sm text-red-300 hover:text-red-400 transition flex items-center gap-1"
          >
            <span>←</span>
            <span>Назад</span>
          </Link>
        </div>
      </div>

      {/* панель фильтров */}
      <div className="rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl px-4 py-3 md:px-5 md:py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {/* статус */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Статус
          </span>
          <div className="inline-flex rounded-full bg-white/5 p-1 gap-1">
            {[
              { key: "all", label: "Все" },
              { key: "open", label: "Открытые" },
              { key: "in_review", label: "На рассмотрении" },
              { key: "request_84", label: "8.4 ПГО" },
            ].map((f) => (
              <Link
                key={f.key}
                href={buildUrl({ page: 1, status: f.key })}
                className={`px-3 py-1 rounded-full text-xs md:text-[13px] transition ${
                  statusFilter === f.key
                    ? "bg-red-500 text-white shadow-[0_0_18px_rgba(248,113,113,0.7)]"
                    : "text-slate-300 hover:text-slate-50"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>

        {/* сортировка */}
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500">
            Сортировка
          </span>
          <div className="inline-flex rounded-full bg-white/5 p-1 gap-1">
            {[
              { key: "new", label: "Новые" },
              { key: "old", label: "Старые" },
            ].map((s) => (
              <Link
                key={s.key}
                href={buildUrl({ page: 1, sortBy: s.key })}
                className={`px-3 py-1 rounded-full text-xs md:text-[13px] transition ${
                  sort === s.key
                    ? "bg-red-500 text-white shadow-[0_0_18px_rgba(248,113,113,0.7)]"
                    : "text-slate-300 hover:text-slate-50"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* список жалоб */}
      <div className="space-y-3">
        {pageItems.map((item) => {
          const { label, classes } = getStatusConfig(item.status);

          return (
            <Link
              key={item.threadId}
              href={item.url}
              target="_blank"
              className="group block rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl px-4 py-3 md:px-5 md:py-4 hover:border-red-400/80 hover:bg-black/70 transition-colors"
            >
              <div className="flex flex-col gap-3">
                {/* верхняя строка: заголовок + статус */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-medium text-slate-100 group-hover:text-red-300 transition-colors truncate">
                      {item.title}
                    </h2>
                    {item.complaintAuthor && (
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Автор:{" "}
                        <span className="text-slate-300">
                          {item.complaintAuthor}
                        </span>
                      </div>
                    )}
                  </div>

                  <span
                    className={
                      "px-3 py-1 rounded-full text-[11px] border whitespace-nowrap " +
                      classes
                    }
                  >
                    {label}
                  </span>
                </div>

                {/* текст жалобы */}
                <div className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {item.complaintText || "Текст жалобы отсутствует."}
                </div>

                {/* ответ админа */}
                {item.adminMark && (
                  <div className="rounded-2xl bg-white/3 border border-white/5 px-3 py-2 text-[11px] text-slate-300">
                    <div className="mb-1 text-slate-400">
                      Ответ:{" "}
                      <span className="text-slate-200">
                        {item.adminMark.author}
                      </span>
                    </div>
                    <div className="leading-relaxed line-clamp-3">
                      {item.adminMark.text}
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}

        {pageItems.length === 0 && (
          <p className="text-center text-sm text-slate-500 py-10">
            Жалоб по выбранному фильтру нет.
          </p>
        )}
      </div>

      {/* пагинация */}
      <div className="flex items-center justify-center gap-2 mt-4 text-sm">
        <Link
          href={buildUrl({ page: 1 })}
          className="px-2 py-1 rounded-full border border-white/10 text-slate-400 hover:text-slate-100 hover:border-slate-300 transition"
        >
          «
        </Link>

        <Link
          href={buildUrl({ page: Math.max(1, currentPage - 1) })}
          className="px-2 py-1 rounded-full border border-white/10 text-slate-400 hover:text-slate-100 hover:border-slate-300 transition"
        >
          ‹
        </Link>

        <span className="px-3 py-1 rounded-full bg-white/5 text-slate-100">
          {currentPage} / {totalPages}
        </span>

        <Link
          href={buildUrl({
            page: Math.min(totalPages, currentPage + 1),
          })}
          className="px-2 py-1 rounded-full border border-white/10 text-slate-400 hover:text-slate-100 hover:border-slate-300 transition"
        >
          ›
        </Link>

        <Link
          href={buildUrl({ page: totalPages })}
          className="px-2 py-1 rounded-full border border-white/10 text-slate-400 hover:text-slate-100 hover:border-slate-300 transition"
        >
          »
        </Link>
      </div>

      <p className="text-xs text-slate-500 text-center mt-4">
        Обновлено: {new Date(data.generatedAt).toLocaleString("ru-RU")}
      </p>
    </div>
  );
}