// forum-bot/watch-resolved-commands.js
//
// Бот для РАССМОТРЕННЫХ жалоб.
// Каждые 2 минуты смотрит последние 10 тем,
// ищет финальный ответ админа и формирует команды вида:
//   /ajail 138556 60 Жалоба Igor-0073
//   /hardban 161398 30 Жалоба beli-0011
//   /mute 187460 90 Жалоба beli-0011
//   /gunban 166359 6 Жалоба Zitraks-0071
//
// Пишет в:
//   - resolved-latest.json
//   - resolved-log.jsonl
//   - resolved-processed.json
// И шлёт данные в API панели: /api/forum/resolved

const puppeteer = require("puppeteer");
const speakeasy = require("speakeasy");
const fs = require("fs/promises");
const path = require("path");
const axios = require("axios");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const BASE_URL = "https://forum.majestic-rp.ru";
const RESOLVED_URL = `${BASE_URL}/forums/rassmotrennyye-zhaloby.1149/`;

// === ДАННЫЕ АККА ===
const USERNAME = "kkrilmknrkrkd@gmail.com";
const PASSWORD = "Floro2283377";
const TOTP_SECRET = "JTL263OQAFOGMDML";

// API панели
const API_URL =
  process.env.FORUM_RESOLVED_API_URL ||
  "http://localhost:3000/api/forum/resolved";
const BOT_TOKEN = process.env.FORUM_BOT_TOKEN || "ANTI222333111MAJESTICRP";

// сколько НЕОБРАБОТАННЫХ тредов берём за один проход
const THREAD_LIMIT = 10;

// файлы состояния
const PROCESSED_PATH = path.join(__dirname, "resolved-processed.json");
const LATEST_PATH = path.join(__dirname, "resolved-latest.json");
const LOG_PATH = path.join(__dirname, "resolved-log.jsonl");

// ─────────────────────────────────────────────
// ХЕЛПЕРЫ
// ─────────────────────────────────────────────

async function loadProcessed() {
  try {
    const raw = await fs.readFile(PROCESSED_PATH, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data.processedThreadIds)) {
      return new Set(data.processedThreadIds);
    }
    return new Set();
  } catch {
    return new Set();
  }
}

async function saveProcessed(set) {
  const arr = Array.from(set);
  await fs.writeFile(
    PROCESSED_PATH,
    JSON.stringify({ processedThreadIds: arr }, null, 2),
    "utf8"
  );
}

// логин с 2FA
async function loginForum(page) {
  console.log("➡️ [resolved] Открываем страницу логина...");
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

  console.log("✅ [resolved] Логин/пароль отправлены, ждём 2FA...");

  try {
    await page.waitForSelector('input[name="code"]', { timeout: 10000 });
  } catch {
    console.log(
      "ℹ️ [resolved] Поле 2FA не найдено — возможно, устройство доверенное."
    );
    return;
  }

  const code = speakeasy.totp({
    secret: TOTP_SECRET,
    encoding: "base32",
  });

  console.log("🔐 [resolved] 2FA-код, который вводим:", code);

  await page.type('input[name="code"]', code, { delay: 60 });

  const trustSelector = 'input[name="trust"]';
  if (await page.$(trustSelector)) {
    const checked = await page.$eval(trustSelector, (el) => el.checked);
    if (!checked) await page.click(trustSelector);
  }

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  const url = page.url();
  const content = await page.content();
  const looksLoggedIn =
    !url.includes("/login") &&
    !content.includes('name="login"') &&
    !content.toLowerCase().includes("забыли пароль");

  if (looksLoggedIn) {
    console.log("✅ [resolved] Успешный логин на форум.");
  } else {
    console.warn(
      "⚠️ [resolved] Не удалось уверенно подтвердить логин, но продолжаем."
    );
  }
}

// список тредов в "Рассмотренные жалобы"
async function parseThreadsList(page) {
  return page.evaluate(() => {
    const items = Array.from(
      document.querySelectorAll(".structItem--thread, .structItem")
    );

    function extractIdFromHref(href) {
      const clean = href.split("#")[0].split("?")[0];
      const m = clean.match(/\.([0-9]+)(?:\/|$)/);
      return m ? parseInt(m[1], 10) : 0;
    }

    const threads = items
      .map((item) => {
        const link =
          item.querySelector(".structItem-title a") ||
          item.querySelector("a[href*='/threads/']");
        if (!link) return null;

        const rawHref = link.getAttribute("href") || "";
        const title = link.textContent.trim();
        const cleanHref = rawHref.replace(/\/unread.*$/i, "");
        const id = extractIdFromHref(cleanHref);
        if (!id) return null;

        const fullUrl = cleanHref.startsWith("http")
          ? cleanHref
          : window.location.origin + cleanHref;

        return { id, title, url: fullUrl };
      })
      .filter(Boolean);

    // последние сверху
    threads.sort((a, b) => b.id - a.id);
    return threads;
  });
}

// парсим конкретный тред, ищем финальный ответ админа
async function parseResolvedThread(page, threadUrl) {
  await page.goto(threadUrl, { waitUntil: "networkidle2" });

  await page.waitForSelector("article.message--post", { timeout: 20000 });

  return page.evaluate(() => {
    const titleEl = document.querySelector("h1.p-title-value");
    const title = titleEl ? titleEl.textContent.trim() : document.title;

    const postEls = Array.from(
      document.querySelectorAll("article.message--post")
    );

    function extractPost(el) {
      if (!el) return null;
      const authorEl = el.querySelector(".message-name");
      const bodyEl = el.querySelector(".bbWrapper");
      const author = authorEl ? authorEl.textContent.trim() : "???";
      const text = bodyEl ? bodyEl.textContent.trim() : "";
      return { author, text };
    }

    const posts = postEls.map(extractPost).filter(Boolean);

    const complaint = posts[0] || null;
    const replies = posts.slice(1);

    const decisionKeywords = [
      "demorgan",
      "деморган",
      "hardban",
      "хардбан",
      "бан",
      "ban",
      "варн",
      "warn",
      "mute",
      "мут",
      "gunban",
      "ганбан",
      "оружия",
    ];

    let finalReply = null;

    for (let i = replies.length - 1; i >= 0; i--) {
      const p = replies[i];
      const tl = p.text.toLowerCase();

      const hasDecisionKeyword = decisionKeywords.some((k) =>
        tl.includes(k)
      );
      const hasCloseWords =
        tl.includes("закрыто") || tl.includes("рассмотрено");

      if (hasDecisionKeyword || hasCloseWords) {
        finalReply = p;
        break;
      }
    }

    if (!finalReply && replies.length) {
      finalReply = replies[replies.length - 1];
    }

    return {
      title,
      complaint,
      finalReply,
      allPosts: posts,
    };
  });
}

// ─────────────────────────────────────────────
// ОПРЕДЕЛЕНИЕ ТИПА НАКАЗАНИЯ
// ─────────────────────────────────────────────

function detectPunishmentType(fragment) {
  const t = fragment.toLowerCase();

  // gunban
  if (
    t.includes("gunban") ||
    t.includes("ганбан") ||
    (t.includes("блокиров") && t.includes("оруж"))
  ) {
    return "gunban";
  }

  // hardban
  if (
    t.includes("hardban") ||
    t.includes("хардбан") ||
    t.includes("пермбан") ||
    t.includes("permban")
  ) {
    return "hardban";
  }

  // ajail / demorgan / спец-тюрьма
  if (
    t.includes("demorgan") ||
    t.includes("деморган") ||
    t.includes("спец. тюр") ||
    t.includes("спец-тюр") ||
    t.includes("спец тюр") ||
    t.includes("джайл")
  ) {
    return "ajail";
  }

  // mute
  if (
    t.includes("mute") ||
    t.includes("mut'a") ||
    t.includes("мут") ||
    t.includes("мута") ||
    t.includes("мьют") ||
    (t.includes("блокиров") &&
      (t.includes("чата") || t.includes("chat") || t.includes("voice")))
  ) {
    return "mute";
  }

  // warn
  if (
    t.includes("warn") ||
    t.includes("варн") ||
    t.includes("warning") ||
    t.includes("предупрежден") ||
    t.includes("выговор")
  ) {
    return "warn";
  }

  // обычный бан
  if (
    t.includes("ban") ||
    t.includes("блокиров") ||
    t.includes("банен") ||
    t.includes("забан")
  ) {
    return "ban";
  }

  return null;
}

// ─────────────────────────────────────────────
// ПАРСИНГ НАКАЗАНИЙ ИЗ ТЕКСТА
// ─────────────────────────────────────────────

function extractPunishmentsFromText(replyText, threadTitle) {
  const text = replyText.replace(/\r/g, "");
  const result = [];

  const re = /Игрок[^\n#]*#?(\d{3,9})([^.\n]{0,220})/gi;

  let m;
  while ((m = re.exec(text)) !== null) {
    const staticId = m[1];
    const context = m[2] || "";
    const lowerCtx = context.toLowerCase();

    const type = detectPunishmentType(lowerCtx);
    if (!type) continue;

    let durationNum = null;
    let unit = null;

    const durRe = /(\d+)\s*(минут|мин|дней|дня|день|часов|часа|час)/i;
    const dm = durRe.exec(context);
    if (dm) {
      durationNum = parseInt(dm[1], 10);
      const unitWord = dm[2].toLowerCase();
      if (unitWord.startsWith("мин")) unit = "minutes";
      else if (unitWord.startsWith("час")) unit = "hours";
      else if (unitWord.startsWith("д")) unit = "days";
    }

    const baseCmd = {
      ajail: "/ajail",
      hardban: "/hardban",
      ban: "/ban",
      warn: "/warn",
      mute: "/mute",
      gunban: "/gunban",
    }[type];

    let command = `${baseCmd} ${staticId}`;

    if (
      durationNum != null &&
      ["ajail", "mute", "ban", "hardban", "gunban"].includes(type)
    ) {
      command += ` ${durationNum}`;
    }

    command += ` Жалоба ${threadTitle}`;

    result.push({
      type,
      staticId,
      duration: durationNum,
      unit, // minutes / hours / days / null
      command,
      context: context.trim(),
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// ОСНОВНОЙ ЦИКЛ
// ─────────────────────────────────────────────

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

    const processed = await loadProcessed();
    console.log(
      `▶️ [resolved] Старт вотчера. Уже обработано тем: ${processed.size}`
    );

    const INTERVAL = 120_000; // 2 минуты

    while (true) {
      try {
        console.log(
          "\n⏱  [resolved] Проверяем новые РАССМОТРЕННЫЕ жалобы..."
        );
        await page.goto(RESOLVED_URL, { waitUntil: "networkidle2" });

        await page.waitForSelector(".structItem--thread, .structItem", {
          timeout: 20000,
        });

        const threads = await parseThreadsList(page);

        if (!threads.length) {
          console.log(
            "❌ [resolved] Не нашли ни одной темы в разделе рассмотренных."
          );
        } else {
          // 🔥 СНАЧАЛА фильтруем уже обработанные, ПОТОМ режем по лимиту
          const unprocessed = threads.filter((t) => !processed.has(t.id));

          if (!unprocessed.length) {
            console.log(
              "ℹ️ [resolved] Нет новых необработанных тем на этой странице."
            );
          }

          const toCheck = unprocessed.slice(0, THREAD_LIMIT);

          for (const th of toCheck) {
            console.log(
              `\n➡️ [resolved] Обрабатываем тему [${th.id}] "${th.title}"`
            );

            const detail = await parseResolvedThread(page, th.url);

            const complaint = detail.complaint;
            const finalReply = detail.finalReply;

            if (!finalReply) {
              console.log(
                "⚠️ [resolved] Не нашли финальный ответ админа в теме."
              );
              processed.add(th.id);
              continue;
            }

            const adminForumName = finalReply.author;
            const punishments = extractPunishmentsFromText(
              finalReply.text,
              detail.title
            );

            console.log("👤 Админ (форум):", adminForumName);
            console.log("📌 Тема:", detail.title);
            console.log("🔗 URL:", th.url);

            if (!punishments.length) {
              console.log(
                "⚠️ [resolved] Не удалось вытащить ни одного наказания из текста."
              );
            } else {
              console.log("✅ [resolved] Найдены наказания:");
              for (const p of punishments) {
                console.log(
                  `   - ${p.command}  (type=${p.type}, id=${p.staticId}, duration=${
                    p.duration ?? "—"
                  } ${p.unit || ""})`
                );
              }
            }

            const payload = {
              threadId: th.id,
              threadTitle: detail.title,
              threadUrl: th.url,
              adminForumName,
              complaint,
              finalReply,
              punishments,
              fetchedAt: new Date().toISOString(),
            };

            // последняя тема
            await fs.writeFile(
              LATEST_PATH,
              JSON.stringify(payload, null, 2),
              "utf8"
            );

            // лог (JSONL)
            await fs.appendFile(
              LOG_PATH,
              JSON.stringify(payload) + "\n",
              "utf8"
            );

            // 👉 отправляем в API панели
            try {
              const res = await axios.post(
                API_URL,
                {
                  adminForumName,
                  threadId: th.id,
                  threadUrl: th.url,
                  threadTitle: detail.title,
                  punishments,
                },
                {
                  headers: {
                    "x-forum-bot-token": BOT_TOKEN,
                    "Content-Type": "application/json",
                  },
                }
              );
              console.log(
                "📡 [resolved] Отправлено в API панели:",
                res.status,
                res.data
              );
            } catch (err) {
              console.error(
                "💥 [resolved] Ошибка отправки в API:",
                err.response?.status,
                err.response?.data || err.message
              );
            }

            processed.add(th.id);
            await saveProcessed(processed);
          }
        }
      } catch (err) {
        console.error("💥 [resolved] Ошибка в итерации:", err.message);
      }

      console.log(
        `\n🕒 [resolved] Ждём ${INTERVAL / 1000} секунд до следующей проверки...\n`
      );
      await new Promise((r) => setTimeout(r, INTERVAL));
    }
  } catch (err) {
    console.error("❌ [resolved] Фатальная ошибка:", err);
  } finally {
    // при бесконечном вотчере браузер не закрываем
  }
}

main();