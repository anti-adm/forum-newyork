// forum-bot/fetch-latest-resolved.js
// Берём последнюю РАССМОТРЕННУЮ жалобу и вытаскиваем заголовок + текст постов

const puppeteer = require("puppeteer");
const fs = require("fs/promises");
const path = require("path");

const RESOLVED_URL =
  "https://forum.majestic-rp.ru/forums/rassmotrennyye-zhaloby.1149/";

// путь к cookies, которые мы сохранили в login-forum.js
const COOKIES_PATH = path.join(__dirname, "cookies.json");

async function loadCookies() {
  try {
    const raw = await fs.readFile(COOKIES_PATH, "utf-8");
    const cookies = JSON.parse(raw);
    console.log("✅ Cookies подгружены");
    return cookies;
  } catch (e) {
    console.error("❌ Не удалось прочитать cookies.json. Сначала запусти login-forum.js");
    throw e;
  }
}

async function main() {
  const cookies = await loadCookies();

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  const page = await browser.newPage();
  await page.setCookie(...cookies);

  // 1) Открываем раздел РАССМОТРЕННЫХ жалоб
  console.log("➡️ Открываем раздел РАССМОТРЕННЫХ жалоб:", RESOLVED_URL);
  await page.goto(RESOLVED_URL, { waitUntil: "networkidle2" });

  // 2) Ищем список тем
  const threads = await page.$$eval(
    "div.structItem.structItem--thread div.structItem-title a",
    (links) =>
      links.map((a) => ({
        title: a.textContent.trim(),
        href: a.href,
      }))
  );

  if (!threads || threads.length === 0) {
    console.error("❌ Не нашли ни одной темы в рассмотренных жалобах.");
    await browser.close();
    return;
  }

  const latest = threads[0];

  console.log("🧵 Нашли последнюю РАССМОТРЕННУЮ жалобу:");
  console.log("   Заголовок:", latest.title);
  console.log("   URL:", latest.href);

  // 3) Открываем сам тред
  console.log("➡️ Открываем тред с жалобой...");
  await page.goto(latest.href, { waitUntil: "networkidle2" });

  // 4) Собираем посты
  const posts = await page.$$eval("article.message", (nodes) =>
    nodes.map((el) => {
      const author =
        el.getAttribute("data-author") ||
        (el.querySelector(".message-name")?.textContent.trim() ?? "???");
      const text =
        el.querySelector(".bbWrapper")?.innerText.trim() ??
        el.innerText.trim();
      return { author, text };
    })
  );

  if (!posts || posts.length === 0) {
    console.log("⚠️ Не нашли ни одного поста в треде.");
    await browser.close();
    return;
  }

  const complaint = posts[0];
  const firstReply = posts[1] ?? null;

  console.log("\n===== ТЕМА ЖАЛОБЫ =====");
  console.log(latest.title);
  console.log("=======================\n");

  console.log("===== ПЕРВЫЙ ПОСТ (жалоба игрока) =====");
  console.log("Автор:", complaint.author);
  console.log("----");
  console.log(complaint.text);
  console.log("======================================\n");

  if (firstReply) {
    console.log("===== ПЕРВЫЙ ОТВЕТ (скорее всего админ) =====");
    console.log("Автор:", firstReply.author);
    console.log("----");
    console.log(firstReply.text);
    console.log("===========================================\n");
  } else {
    console.log("⚠️ В треде пока нет ответов, только жалоба.");
  }

  // 5) Сохраняем всё в JSON — это то, что потом будем парсить в /ajail и т.п.
  const structured = {
    title: latest.title,        // например "Igor-0073"
    url: latest.href,
    complaint,
    firstReply,
    scrapedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    path.join(__dirname, "last-resolved.json"),
    JSON.stringify(structured, null, 2),
    "utf8"
  );

  console.log("💾 Структура сохранена в forum-bot/last-resolved.json");

  // подержим вкладку открытой
  await new Promise((r) => setTimeout(r, 8000));
  await browser.close();
}

main().catch((err) => {
  console.error("Ошибка в fetch-latest-resolved:", err);
  process.exit(1);
});