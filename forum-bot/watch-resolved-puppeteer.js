// forum-bot/watch-resolved-puppeteer.js
const puppeteer = require("puppeteer");
const speakeasy = require("speakeasy");
const fs = require("fs/promises");
const path = require("path");
const { parsePunishment } = require("./parse-punishment");

const BASE_URL = "https://forum.majestic-rp.ru";
const RESOLVED_URL = `${BASE_URL}/forums/rassmotrennyye-zhaloby.1149/`;

// 🔐 ТВОИ ДАННЫЕ (те же, что в login-forum.js)
const USERNAME = "kkrilmknrkrkd@gmail.com";
const PASSWORD = "Floro2283377";
const TOTP_SECRET = "JTL263OQAFOGMDML";

// где будем хранить последний threadId
const LAST_ID_PATH = path.join(__dirname, "last-thread-id.txt");

// —————————————————————————
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// —————————————————————————

async function loadLastThreadId() {
  try {
    const txt = await fs.readFile(LAST_ID_PATH, "utf8");
    const n = parseInt(txt.trim(), 10);
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

async function saveLastThreadId(id) {
  await fs.writeFile(LAST_ID_PATH, String(id), "utf8");
}

// парсим список тем на странице рассмотренных жалоб
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

        const title = link.textContent.trim();
        const href = link.getAttribute("href") || "";
        const m = href.match(/\.([0-9]+)\/?$/);
        const id = m ? parseInt(m[1], 10) : 0;

        return {
          id,
          title,
          url: href.startsWith("http")
            ? href
            : window.location.origin + href,
        };
      })
      .filter((t) => t && t.id);

    threads.sort((a, b) => b.id - a.id);
    return threads;
  });
}

// парсим сам тред: заголовок, жалоба, первый ответ
async function parseThreadDetail(page) {
  return await page.evaluate(() => {
    const titleEl = document.querySelector("h1.p-title-value");
    const title = titleEl ? titleEl.textContent.trim() : "";

    const posts = Array.from(
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

    const complaint = extractPost(posts[0]) || null;
    const firstReply = extractPost(posts[1]) || null;

    return {
      title,
      complaint,
      firstReply,
    };
  });
}

// логинимся на форум (включая 2FA)
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

// —————————————————————————
// ОСНОВНОЙ ЦИКЛ ВОТЧЕРА
// —————————————————————————

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
  });

  const page = await browser.newPage();

  try {
    await loginForum(page);

    let lastThreadId = await loadLastThreadId();
    console.log(
      `\n▶️ Стартуем вотчер рассмотренных жалоб. lastThreadId = ${lastThreadId}\n`
    );

    while (true) {
      console.log("⏱  Проверяем новые рассмотренные жалобы...");

      await page.goto(RESOLVED_URL, {
        waitUntil: "networkidle2",
      });

      const threads = await parseThreadsList(page);

      if (!threads.length) {
        console.log("❌ Не нашли ни одной темы (после anti-DDoS страницы).");
      } else {
        const latest = threads[0];

        console.log(
          `🧵 Последняя тема: [${latest.id}] ${latest.title} — ${latest.url}`
        );

        if (latest.id > lastThreadId) {
          console.log(
            `✨ Обнаружена НОВАЯ рассмотренная жалоба (старый = ${lastThreadId}, новый = ${latest.id})`
          );

          await page.goto(latest.url, {
            waitUntil: "networkidle2",
          });

          const detail = await parseThreadDetail(page);

          console.log("\n===== НОВАЯ РАССМОТРЕННАЯ ЖАЛОБА =====");
          console.log("Тема:", detail.title);
          if (detail.complaint) {
            console.log("\n[Жалоба игрока]");
            console.log("Автор:", detail.complaint.author);
            console.log(detail.complaint.text);
          }
          if (detail.firstReply) {
            console.log("\n[Ответ администратора]");
            console.log("Автор:", detail.firstReply.author);
            console.log(detail.firstReply.text);
          }

          // 🔥 тут дергаем парсер наказания
          let parsed = null;
          if (detail.firstReply && detail.firstReply.text) {
            parsed = parsePunishment(detail.firstReply.text, detail.title);

            console.log("\n===== СФОРМИРОВАННАЯ КОМАНДА =====");
            if (parsed.command) {
              console.log(parsed.command);
            } else {
              console.log("❌ Команда не распознана");
            }
            console.log("Тип:", parsed.type);
            console.log("Static ID:", parsed.staticId);
            console.log("Длительность:", parsed.duration);
            console.log("Код жалобы:", parsed.complaintCode);
            console.log("===================================");
          }

          console.log("=====================================\n");

          const dataToSave = {
            threadId: latest.id,
            threadTitle: detail.title,
            threadUrl: latest.url,
            complaint: detail.complaint,
            reply: detail.firstReply,
            parsedPunishment: parsed,
            fetchedAt: new Date().toISOString(),
          };

          const outPath = path.join(__dirname, "last-resolved.json");
          await fs.writeFile(
            outPath,
            JSON.stringify(dataToSave, null, 2),
            "utf8"
          );
          console.log(`💾 Данные сохранены в ${outPath}`);

          lastThreadId = latest.id;
          await saveLastThreadId(lastThreadId);
        } else {
          console.log(
            `Нет новых тем. Текущий top id = ${latest.id}, lastThreadId = ${lastThreadId}`
          );
        }
      }

      console.log("\n🕒 Ждём 60 секунд до следующей проверки...\n");
      await new Promise((r) => setTimeout(r, 60_000));
    }
  } catch (err) {
    console.error("❌ Ошибка в вотчере:", err);
  } finally {
    // браузер оставляем жить, чтобы вотчер крутился бесконечно
  }
}

main();