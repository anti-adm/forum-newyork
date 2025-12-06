// forum-bot/watch-active-puppeteer.js
// Долгоживущий вотчер:
// - один браузер Puppeteer
// - логинимся один раз (при необходимости перелогиниваемся)
// - каждые 60 сек сканируем актуальные жалобы и обновляем JSON для сайта

const puppeteer = require("puppeteer");
const speakeasy = require("speakeasy");
const fs = require("fs/promises");
const path = require("path");

// ===== НАСТРОЙКИ =====

const BASE_URL = "https://forum.majestic-rp.ru";
const COMPLAINTS_URL = `${BASE_URL}/forums/zhaloby-na-igrokov.1148/`;

const USERNAME = "kkrilmknrkrkd@gmail.com";
const PASSWORD = "Floro2283377";
const TOTP_SECRET = "JTL263OQAFOGMDML";

const THREAD_LIMIT = 30;

const OUT_PATH = path.join(__dirname, "active-complaints.json");
const SITE_OUT_PATH = path.join(
  __dirname,
  "../public/forum-data/active-complaints.json"
);

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====

// логин с 2FA
async function loginForum(page) {
  console.log("➡️ [login] Открываем страницу логина...");
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

  console.log("✅ [login] Логин/пароль отправлены, ждём 2FA...");

  // ждём поле кода (если 2FA включена)
  try {
    await page.waitForSelector('input[name="code"]', { timeout: 10000 });
  } catch {
    console.log(
      "ℹ️ [login] Поле 2FA не найдено — возможно, устройство доверенное."
    );
    return;
  }

  const code = speakeasy.totp({
    secret: TOTP_SECRET,
    encoding: "base32",
  });

  console.log("🔐 [login] 2FA-код, который вводим:", code);

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

  console.log("⏳ [login] Проверяем, что вход прошёл...");

  const url = page.url();
  const content = await page.content();

  const looksLoggedIn =
    !url.includes("/login") &&
    !content.includes('name="login"') &&
    !content.toLowerCase().includes("забыли пароль");

  if (looksLoggedIn) {
    console.log("✅ [login] Успешный логин на форум.");
  } else {
    console.warn(
      "⚠️ [login] Не удалось уверенно подтвердить логин, но продолжаем."
    );
  }
}

// список тредов (с фильтром «правил»)
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

    const filtered = threads.filter((t) => {
      const lower = t.title.toLowerCase();
      if (lower.includes("правила подачи жалоб")) return false;
      if (lower.includes("правила раздела")) return false;
      return true;
    });

    filtered.sort((a, b) => b.id - a.id);
    return filtered;
  });
}

// статус конкретной жалобы
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

    let status = "open";
    let firstMark = null;

    for (const post of posts) {
      const textLower = (post.text || "").toLowerCase();

      if (textLower.includes("на рассмотрении")) {
        status = "in_review";
        if (!firstMark) {
          firstMark = {
            author: post.author,
            text: post.text,
          };
        }
        break;
      }
    }

    const complaint = posts[0] || null;

    return {
      title,
      status,
      complaint,
      firstAdminMark: firstMark,
    };
  });
}

// один прогон скана, используя УЖЕ залогиненную вкладку
async function scanOnce(page) {
  console.log(`\n➡️ [scan] Открываем раздел жалоб: ${COMPLAINTS_URL}`);
  await page.goto(COMPLAINTS_URL, {
    waitUntil: "networkidle2",
  });

  // если нас вдруг выкинуло на /login — перелогиниваемся и снова идём в раздел
  const url = page.url();
  if (url.includes("/login")) {
    console.log("⚠️ [scan] Похоже, сессия умерла — перелогиниваемся...");
    await loginForum(page);
    await page.goto(COMPLAINTS_URL, {
      waitUntil: "networkidle2",
    });
  }

  await page.waitForSelector(".structItem--thread, .structItem", {
    timeout: 20000,
  });

  const threads = await parseThreadsList(page);

  if (!threads.length) {
    console.log("❌ [scan] Не нашли ни одной жалобы на странице.");
    return;
  }

  const toCheck = threads.slice(0, THREAD_LIMIT);

  console.log(
    `🔎 [scan] Нашли ${threads.length} тем (после фильтра), проверяем первые ${toCheck.length}...`
  );

  const results = [];

  for (const [index, th] of toCheck.entries()) {
    console.log(
      `\n[${index + 1}/${toCheck.length}] Открываем жалобу: ${th.title} (${th.url})`
    );

    await page.goto(th.url, {
      waitUntil: "networkidle2",
    });

    await page.waitForSelector("article.message--post", {
      timeout: 20000,
    });

    const detail = await parseComplaintStatus(page);

    console.log(
      `   Статус: ${
        detail.status === "in_review" ? "На рассмотрении" : "Открыта"
      }`
    );

    results.push({
      threadId: th.id,
      title: detail.title || th.title,
      url: th.url,
      status: detail.status,
      complaintAuthor: detail.complaint ? detail.complaint.author : null,
      complaintText: detail.complaint ? detail.complaint.text : null,
      adminMark: detail.firstAdminMark || null,
    });
  }

  const total = results.length;
  const inReview = results.filter((r) => r.status === "in_review").length;
  const open = results.filter((r) => r.status === "open").length;

  console.log("\n===== [scan] ИТОГ ПО АКТУАЛЬНЫМ ЖАЛОБАМ =====");
  console.log(`Всего в выборке: ${total}`);
  console.log(`На рассмотрении: ${inReview}`);
  console.log(`Открыты (без статуса): ${open}`);
  console.log("======================================\n");

  const payload = {
    generatedAt: new Date().toISOString(),
    total,
    inReview,
    open,
    items: results,
  };

  await fs.writeFile(OUT_PATH, JSON.stringify(payload, null, 2), "utf8");
  console.log(`💾 [scan] Данные сохранены локально в ${OUT_PATH}`);

  try {
    await fs.mkdir(path.dirname(SITE_OUT_PATH), { recursive: true });
    await fs.writeFile(
      SITE_OUT_PATH,
      JSON.stringify(payload, null, 2),
      "utf8"
    );
    console.log(`📡 [scan] Данные переданы сайту в ${SITE_OUT_PATH}`);
  } catch (e) {
    console.error("⚠️ [scan] Не удалось передать данные сайту:", e);
  }
}

// ===== ГЛАВНАЯ ФУНКЦИЯ ВОТЧЕРА =====

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  try {
    await loginForum(page);

    console.log(
      "\n🚀 Стартуем бесконечный вотчер актуальных жалоб (интервал ~60 сек)..."
    );

    // первый прогон сразу
    await scanOnce(page);

    // дальше — бесконечный цикл
    while (true) {
      console.log("\n🕒 Ждём 60 секунд до следующей проверки...\n");
      await new Promise((r) => setTimeout(r, 60_000));

      try {
        await scanOnce(page);
      } catch (err) {
        console.error("❌ Ошибка в scanOnce:", err);
      }
    }
  } catch (err) {
    console.error("❌ Ошибка в вотчере:", err);
  } finally {
    // теоретически мы сюда не попадём, пока скрипт не остановят руками
    // await browser.close();
  }
}

main();