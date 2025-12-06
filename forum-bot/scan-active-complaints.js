// forum-bot/scan-active-complaints.js
//
// Скрипт сканирует раздел "Жалобы на игроков", обходит несколько страниц,
// парсит треды и определяет статус жалобы:
//   - "open"        — открыта
//   - "in_review"   — на рассмотрении
//   - "request_84"  — запрос 8.4 ПГО (будет запрошена видеофиксация)
//
// Результат кладётся в:
//   - forum-bot/active-complaints.json
//   - public/forum-data/active-complaints.json (для сайта)

const puppeteer = require("puppeteer");
const speakeasy = require("speakeasy");
const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://forum.majestic-rp.ru";
const COMPLAINTS_URL = `${BASE_URL}/forums/zhaloby-na-igrokov.1148/`;

// ДАННЫЕ АККА
const USERNAME = "kkrilmknrkrkd@gmail.com";
const PASSWORD = "Floro2283377";
const TOTP_SECRET = "JTL263OQAFOGMDML";

// Ограничения
const MAX_PAGES = 20;
const MAX_THREADS = 200;

// Пути вывода
const OUT_PATH = path.join(__dirname, "active-complaints.json");
const SITE_OUT_PATH = path.join(
  __dirname,
  "../public/forum-data/active-complaints.json"
);

/* ============================================================
 * ЛОГИН
 * ============================================================ */
async function loginForum(page) {
  console.log("➡️ Открываем страницу логина...");
  await page.goto(`${BASE_URL}/login/login`, {
    waitUntil: "networkidle2",
  });

  await page.waitForSelector('input[name="login"]', { timeout: 15000 });

  await page.type('input[name="login"]', USERNAME, { delay: 40 });
  await page.type('input[name="password"]', PASSWORD, { delay: 40 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  console.log("✅ Логин/пароль отправлены, ждём 2FA...");

  try {
    await page.waitForSelector('input[name="code"]', { timeout: 10000 });
  } catch {
    console.log("ℹ️ Поле 2FA не найдено — возможно, устройство доверенное.");
    return;
  }

  const code = speakeasy.totp({
    secret: TOTP_SECRET,
    encoding: "base32",
  });

  console.log("🔐 2FA-код, который вводим:", code);

  await page.type('input[name="code"]', code, { delay: 60 });

  const trustSelector = 'input[name="trust"]';
  if (await page.$(trustSelector)) {
    const checked = await page.$eval(trustSelector, (el) => el.checked);
    if (!checked) {
      await page.click(trustSelector);
    }
  }

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  console.log("⏳ Проверяем, что вход прошёл...");

  const url = page.url();
  const content = await page.content();

  const looksLoggedIn =
    !url.includes("/login") &&
    !content.includes('name="login"') &&
    !content.toLowerCase().includes("забыли пароль");

  if (looksLoggedIn) {
    console.log("✅ Успешный логин на форум (по URL/форме входа).");
  } else {
    console.warn("⚠️ Не удалось уверенно подтвердить логин, но продолжаем.");
  }
}

/* ============================================================
 * СПИСОК ТРЕДОВ
 * ============================================================ */

async function parseThreadsList(page) {
  return await page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll(".structItem--thread, .structItem")
    );

    const threads = items
      .map((item) => {
        const link =
          item.querySelector(".structItem-title a") ||
          item.querySelector("a[href*='/threads/']");

        if (!link) return null;

        const rawHref = link.getAttribute("href") || "";
        const title = link.textContent.trim();

        // убираем /unread, query и anchors
        let cleanHref = rawHref.replace(/\/unread.*$/i, "");
        cleanHref = cleanHref.split("#")[0].split("?")[0];

        const m = cleanHref.match(/\.([0-9]+)(?:\/|$)/);
        const id = m ? parseInt(m[1], 10) : 0;
        if (!id) return null;

        const fullUrl = cleanHref.startsWith("http")
          ? cleanHref
          : window.location.origin + cleanHref;

        return {
          id,
          title,
          url: fullUrl,
        };
      })
      .filter((t) => t && t.id);

    // фильтруем служебные темы
    const filtered = threads.filter((t) => {
      const lower = t.title.toLowerCase();
      if (lower.includes("правила подачи жалоб")) return false;
      if (lower.includes("правила раздела")) return false;
      return true;
    });

    // свежие сверху
    filtered.sort((a, b) => b.id - a.id);
    return filtered;
  });
}

/* ============================================================
 * ПАРСИНГ КОНКРЕТНОЙ ЖАЛОБЫ + ОПРЕДЕЛЕНИЕ СТАТУСА
 * ============================================================ */

// ВАЖНО: вставь ЭТУ функцию вместо старой parseComplaintStatus в scan-active-complaints.js

async function parseComplaintStatus(page) {
  return await page.evaluate(() => {
    const titleEl = document.querySelector("h1.p-title-value");
    const title = titleEl ? titleEl.textContent.trim() : "";

    const postsEls = Array.from(
      document.querySelectorAll("article.message--post")
    );

    function extractPost(el) {
      if (!el) return null;

      const authorEl = el.querySelector(".message-name");
      const bodyEl = el.querySelector(".bbWrapper");
      const roleEl = el.querySelector(".userBanner, .userTitle");

      const author = authorEl ? authorEl.textContent.trim() : "???";
      const text = bodyEl ? bodyEl.textContent.trim() : "";
      const role = roleEl ? roleEl.textContent.trim() : "";

      return { author, text, role };
    }

    const posts = postsEls.map(extractPost).filter(Boolean);

    // ---- ОПРЕДЕЛЕНИЕ СТАТУСА ----
    // open | in_review | request_84
    let status = "open";
    let firstMark = null;

    // наборы "паттернов"
    const videoKeywords = [
      "видеофиксац",       // видеофиксация / видеофиксацию / ...
      "видео фиксац",
      "видеозапис",        // видеозапись / видеозаписью / ...
      "видео-запис",
      "video"              // на всякий
    ];

    const reviewPatterns = [
      "на рассмотрении",
      "беру в рассмотрение",
      "жалоба принята к рассмотрению",
      "жалоба принята в рассмотрение",
      "жалобу принял в рассмотрение",
      "взял в рассмотрение",
      "взята в рассмотрение"
    ];

    for (const post of posts) {
      const text = post.text || "";
      const t = text.toLowerCase();

      const hasVideo = videoKeywords.some((k) => t.includes(k));
      const has84 =
        t.includes("8.4") || t.includes("8,4") || t.includes("8 § 4");

      // --------- запрос 8.4 ПГО ---------
      // Пример: "Запросил видеофиксацию согласно 8.4 ПГО."
      // Достаточно "видеофиксац/видеозапис" + "8.4/8,4"
      if (hasVideo && has84) {
        status = "request_84";
        if (!firstMark) {
          firstMark = {
            author: post.author,
            text: post.text
          };
        }
        break; // статус максимального приоритета, дальше можно не смотреть
      }

      // --------- "на рассмотрении" ---------
      const hasExplicitReview = reviewPatterns.some((k) => t.includes(k));

      const hasGenericReview =
        !hasExplicitReview &&
        t.includes("рассмотр") &&        // корень "рассмотрен/рассмотрению/рассмотрения"
        t.includes("жалоб") &&           // жалоба / жалобу / жалобы
        !t.includes("рассмотрена");      // стараемся не ловить "жалоба рассмотрена"

      if ((hasExplicitReview || hasGenericReview) && status === "open") {
        status = "in_review";
        if (!firstMark) {
          firstMark = {
            author: post.author,
            text: post.text
          };
        }
        // не делаем break — вдруг в более позднем сообщении есть запрос 8.4,
        // который важнее и должен переписать статус.
      }
    }

    const complaint = posts[0] || null;

    return {
      title,
      status,              // "open" | "in_review" | "request_84"
      complaint,
      firstAdminMark: firstMark
    };
  });
}

/* ============================================================
 * MAIN
 * ============================================================ */

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
    ],
  });

  const page = await browser.newPage();

  try {
    await loginForum(page);

    let allThreads = [];
    let currentPage = 1;

    console.log(
      `\n➡️ Начинаем обход страниц жалоб: ${COMPLAINTS_URL} (до ${MAX_PAGES} страниц, максимум ${MAX_THREADS} тредов)`
    );

    // обходим страницы с жалобами
    while (currentPage <= MAX_PAGES && allThreads.length < MAX_THREADS) {
      const url =
        currentPage === 1
          ? COMPLAINTS_URL
          : `${COMPLAINTS_URL}page-${currentPage}/`;

      console.log(`\n📄 Страница ${currentPage}: ${url}`);

      await page.goto(url, {
        waitUntil: "networkidle2",
      });

      try {
        await page.waitForSelector(".structItem--thread, .structItem", {
          timeout: 15000,
        });
      } catch {
        console.log("   ⛔ Тем на странице не нашли, дальше страниц нет.");
        break;
      }

      const pageThreads = await parseThreadsList(page);

      if (!pageThreads.length) {
        console.log("   ⛔ После фильтрации тредов нет, дальше нет смысла.");
        break;
      }

      console.log(
        `   ✅ Нашли ${pageThreads.length} тред(ов) на странице (после фильтра).`
      );

      allThreads.push(...pageThreads);

      if (allThreads.length >= MAX_THREADS) {
        console.log(
          `   ⚠️ Достигнут лимит MAX_THREADS = ${MAX_THREADS}, дальше страницы не обходим.`
        );
        break;
      }

      currentPage += 1;
    }

    if (!allThreads.length) {
      console.log("❌ Не нашли ни одной жалобы (ни на одной странице).");
      await browser.close();
      return;
    }

    // убираем дубли по id
    const mapById = new Map();
    for (const t of allThreads) {
      if (!mapById.has(t.id)) {
        mapById.set(t.id, t);
      }
    }
    const uniqueThreads = Array.from(mapById.values());

    // свежие выше
    uniqueThreads.sort((a, b) => b.id - a.id);

    console.log(
      `\n🔎 Суммарно собрали ${uniqueThreads.length} уникальных тредов (до лимита ${MAX_THREADS}).`
    );

    const results = [];

    // обходим каждый тред
    for (const [index, th] of uniqueThreads.entries()) {
      console.log(
        `\n[${index + 1}/${uniqueThreads.length}] Открываем жалобу: ${th.title} (${th.url})`
      );

      await page.goto(th.url, {
        waitUntil: "networkidle2",
      });

      try {
        await page.waitForSelector("article.message--post", {
          timeout: 20000,
        });
      } catch {
        console.warn(
          "   ⚠️ Не нашли ни одного поста в треде, пропускаем его."
        );
        continue;
      }

      const detail = await parseComplaintStatus(page);

      let statusLabel = "Открыта";
      if (detail.status === "in_review") statusLabel = "На рассмотрении";
      if (detail.status === "request_84") statusLabel = "Запрос 8.4 ПГО";

      console.log(`   Статус: ${statusLabel}`);

      results.push({
        threadId: th.id,
        title: detail.title || th.title,
        url: th.url,
        status: detail.status, // "open" | "in_review" | "request_84"
        complaintAuthor: detail.complaint ? detail.complaint.author : null,
        complaintText: detail.complaint ? detail.complaint.text : null,
        adminMark: detail.firstAdminMark || null,
      });
    }

    const total = results.length;
    const inReview = results.filter((r) => r.status === "in_review").length;
    const open = results.filter((r) => r.status === "open").length;
    const request84 = results.filter(
      (r) => r.status === "request_84"
    ).length;

    console.log("\n===== ИТОГ ПО АКТУАЛЬНЫМ ЖАЛОБАМ =====");
    console.log(`Всего в выборке (после сканирования): ${total}`);
    console.log(`На рассмотрении: ${inReview}`);
    console.log(`Открыты (без статуса): ${open}`);
    console.log(`Запрос 8.4 ПГО: ${request84}`);
    console.log("======================================\n");

    const payload = {
      generatedAt: new Date().toISOString(),
      total,
      inReview,
      open,
      request84,
      items: results,
    };

    // локальный файл
    await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");
    console.log(`💾 Данные сохранены локально в ${OUT_PATH}`);

    // файл для сайта
    try {
      await fs.mkdir(path.dirname(SITE_OUT_PATH), { recursive: true });
      await fs.writeFile(
        SITE_OUT_PATH,
        JSON.stringify(payload, null, 2),
        "utf8"
      );
      console.log(`📡 Данные переданы сайту в ${SITE_OUT_PATH}`);
    } catch (e) {
      console.error("⚠️ Не удалось передать данные сайту:", e);
    }
  } catch (err) {
    console.error("❌ Ошибка при сканировании жалоб:", err);
  } finally {
    await browser.close();
  }
}

// если запускаем файл напрямую — стартуем main()
if (require.main === module) {
  main();
}

module.exports = main;