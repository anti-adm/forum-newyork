// forum-bot/fetch-latest-complaint.js
const puppeteer = require("puppeteer");
const fs = require("fs/promises");

const BASE_URL =
  "https://forum.majestic-rp.ru/forums/zhaloby-na-igrokov.1148/";

// Загружаем cookies, сохранённые login-forum.js
async function loadCookies(browser) {
  const cookiesJson = await fs.readFile("cookies.json", "utf-8");
  const cookies = JSON.parse(cookiesJson);

  const page = await browser.newPage();
  await page.goto("https://forum.majestic-rp.ru", {
    waitUntil: "networkidle2",
  });

  for (const cookie of cookies) {
    await page.setCookie(cookie);
  }

  await page.close();
}

async function main() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  try {
    await loadCookies(browser);
    console.log("✅ Cookies подгружены");

    const page = await browser.newPage();

    // 1) Раздел жалоб
    console.log("➡️ Открываем раздел жалоб:", BASE_URL);
    await page.goto(BASE_URL, { waitUntil: "networkidle2" });

    // 2) Берём последнюю жалобу (пытаемся пропустить закреплённые темы)
    const lastThread = await page.evaluate(() => {
      const articles = Array.from(
        document.querySelectorAll(
          ".structItem--thread, article.structItem--thread"
        )
      );
      if (!articles.length) return null;

      const target = articles[1] || articles[0]; // 1-й, если есть, иначе 0-й
      const link = target.querySelector(".structItem-title a");
      if (!link) return null;

      return {
        title: link.textContent.trim(),
        href: link.getAttribute("href"),
      };
    });

    if (!lastThread) {
      console.log("❌ Не нашли ни одной жалобы в разделе.");
      await browser.close();
      return;
    }

    const threadUrl = lastThread.href.startsWith("http")
      ? lastThread.href
      : `https://forum.majestic-rp.ru${lastThread.href}`;

    console.log("🧵 Нашли последнюю жалобу:");
    console.log("   Заголовок:", lastThread.title);
    console.log("   URL:", threadUrl);

    // 3) Открываем тред
    console.log("➡️ Открываем тред с жалобой...");
    await page.goto(threadUrl, { waitUntil: "networkidle2" });

    // 4) Достаём первый пост: автор + поля формы + текст (если есть)
    const firstPost = await page.evaluate(() => {
      const post =
        document.querySelector("article.message--post") ||
        document.querySelector("article.message");
      if (!post) return null;

      // Автор
      const authorEl =
        post.querySelector(".message-name a") ||
        post.querySelector(".username") ||
        post.querySelector(".message-userDetails a");
      const author = authorEl ? authorEl.textContent.trim() : "???";

      // Поля формы жалобы: все dl.pairs / pairs--justified
      const pairLines = Array.from(
        post.querySelectorAll("dl.pairs, dl.pairs.pairs--justified")
      )
        .map((dl) => {
          const dt = dl.querySelector("dt");
          const dd = dl.querySelector("dd");
          const key = dt ? dt.innerText.trim() : "";
          const val = dd ? dd.innerText.trim() : "";
          if (!key && !val) return "";
          return `${key} ${val}`.trim();
        })
        .filter(Boolean);

      // Текст из самого сообщения (bbWrapper)
      const contentEl =
        post.querySelector(".bbWrapper") ||
        post.querySelector(".message-content");
      let bodyText = contentEl ? contentEl.innerText.trim() : "";

      // Если в теле только "." или вообще пусто — игнорим
      if (bodyText === "." || bodyText === "·") bodyText = "";

      // Склеиваем: сначала поля формы, потом текст
      const lines = [...pairLines];
      if (bodyText) {
        lines.push("", bodyText); // пустая строка как разделитель
      }

      return {
        author,
        text: lines.join("\n"),
      };
    });

    if (!firstPost) {
      console.log("❌ Не смогли найти первый пост в треде.");
      await browser.close();
      return;
    }

    console.log("📄 Текст первого поста (жалобы):");
    console.log("Автор:", firstPost.author);
    console.log("----");
    console.log(firstPost.text.slice(0, 1000));
    if (firstPost.text.length > 1000) {
      console.log("\n... (обрезано) ...");
    }
  } catch (err) {
    console.error("❌ Ошибка в скрипте:", err);
  } finally {
    await new Promise((r) => setTimeout(r, 8000));
    await browser.close();
  }
}

main();