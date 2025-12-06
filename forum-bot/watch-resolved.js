// forum-bot/watch-resolved.js
const axios = require("axios");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");
const fs = require("fs/promises");
const path = require("path");

const BASE_URL = "https://forum.majestic-rp.ru";
const RESOLVED_URL =
  "https://forum.majestic-rp.ru/forums/rassmotrennyye-zhaloby.1149/";

// ====== загрузка куков из cookies.json (формат puppeteer) ======
async function loadCookiesJar(cookiesPath = "cookies.json") {
  const jar = new CookieJar();
  try {
    const raw = await fs.readFile(cookiesPath, "utf8");
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      for (const c of arr) {
        await jar.setCookie(
          `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}; ${
            c.secure ? "Secure;" : ""
          }`,
          BASE_URL
        );
      }
    } else if (arr && arr.cookies) {
      await jar.importCookies(arr, BASE_URL);
    }
    console.log("✅ Cookies подгружены");
  } catch (e) {
    console.error(
      "❌ Не удалось загрузить cookies.json. Сначала запусти login-forum.js",
      e.message
    );
    process.exit(1);
  }
  return jar;
}

function createClient(jar) {
  return wrapper(
    axios.create({
      baseURL: BASE_URL,
      jar,
      withCredentials: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
  );
}

function extractThreadId(url) {
  const m = url.match(/\.([0-9]+)(?:\/|$)/);
  return m ? Number(m[1]) : null;
}

function extractPost($, $post) {
  const author =
    $post.find(".message-name").text().trim() ||
    $post.find(".username").first().text().trim() ||
    "???";

  let text = $post.find(".bbWrapper").text().trim();
  text = text.replace(/\r/g, "");
  text = text.replace(/\n[ \t]+/g, "\n");
  text = text.replace(/\n{3,}/g, "\n\n");

  return { author, text };
}

// простая попытка собрать команду
function buildCommand(threadTitle, replyText) {
  const lower = replyText.toLowerCase();

  let cmd = null;
  if (lower.includes("demorgan")) cmd = "ajail";
  else if (lower.includes("hardban") || lower.includes("хардбан"))
    cmd = "hardban";
  else if (lower.includes("бан") || lower.includes("block") || lower.includes("ban"))
    cmd = "ban";
  else if (lower.includes("варн") || lower.includes("warn")) cmd = "warn";
  else if (lower.includes("мут") || lower.includes("mute")) cmd = "mute";

  if (!cmd) return null;

  const idMatch = replyText.match(/#(\d{3,9})/);
  if (!idMatch) return null;
  const staticId = idMatch[1];

  const minutesMatch = replyText.match(/(\d+)\s+минут/);
  const minutes = minutesMatch ? minutesMatch[1] : null;

  let command = `/${cmd} ${staticId}`;
  if (minutes && (cmd === "ajail" || cmd === "mute")) {
    command += ` ${minutes}`;
  }
  command += ` Жалоба ${threadTitle}`;

  return command;
}

async function parseResolvedThread(client, threadUrl) {
  const res = await client.get(threadUrl);
  const html = typeof res.data === "string" ? res.data : String(res.data);
  const $ = cheerio.load(html);

  const title =
    $(".p-title-value").text().trim() ||
    $("h1").first().text().trim() ||
    threadUrl;

  const posts = $("article.message");
  if (!posts.length) {
    throw new Error("Не нашли ни одного поста в треде");
  }

  const firstPost = extractPost($, posts.eq(0));
  const firstReply =
    posts.length > 1 ? extractPost($, posts.eq(1)) : { author: null, text: "" };

  const command = buildCommand(title, firstReply.text);

  return {
    threadUrl,
    threadId: extractThreadId(threadUrl),
    title,
    complaint: firstPost,
    reply: firstReply,
    command,
  };
}

// ===== processed.json =====

const PROCESSED_PATH = path.join(__dirname, "processed.json");

async function loadProcessed() {
  try {
    const raw = await fs.readFile(PROCESSED_PATH, "utf8");
    const data = JSON.parse(raw);
    return { lastThreadId: data.lastThreadId || 0 };
  } catch {
    return { lastThreadId: 0 };
  }
}

async function saveProcessed(lastThreadId) {
  await fs.writeFile(
    PROCESSED_PATH,
    JSON.stringify({ lastThreadId }, null, 2),
    "utf8"
  );
}

// ===== получение списка тредов на странице =====

function parseThreadsList(html) {
  const $ = cheerio.load(html);

  // 1) пробуем «нормальный» селектор
  let items = $(".structItem--thread");

  // 2) если пусто — fallback: все structItem, у которых есть ссылка на /threads/
  if (!items.length) {
    items = $(".structItem").filter((_, el) => {
      const hasThreadLink = !!$(el)
        .find('.structItem-title a[href*="/threads/"]')
        .length;
      return hasThreadLink;
    });
  }

  const threads = [];

  items.each((_, el) => {
    const link = $(el).find(".structItem-title a").first();
    const href = link.attr("href");
    const title = link.text().trim();
    if (!href) return;
    const fullUrl = new URL(href, BASE_URL).href;
    const threadId = extractThreadId(fullUrl);
    if (!threadId) return;
    threads.push({ threadId, title, url: fullUrl });
  });

  return threads;
}

// ===== tick =====

async function tick(client) {
  const processed = await loadProcessed();
  let { lastThreadId } = processed;

  console.log(
    `\n⏱  Проверяем новые рассмотренные жалобы (lastThreadId = ${lastThreadId})`
  );

    const res = await client.get(RESOLVED_URL);
    const html = typeof res.data === "string" ? res.data : String(res.data);

    // === DEBUG ===
    await fs.writeFile("last-page.html", html, "utf8");
    console.log("📄 DEBUG: HTML страницы сохранён в last-page.html");
    // === END DEBUG ===

    const threads = parseThreadsList(html);

  if (!threads.length) {
    console.log("❌ Не нашли ни одной темы в рассмотренных жалобах.");
    // маленький кусок HTML для дебага (если совсем страшно)
    // console.log(html.slice(0, 1000));
    return;
  }

  // сортируем по id
  threads.sort((a, b) => a.threadId - b.threadId);

  const newThreads = threads.filter((t) => t.threadId > lastThreadId);

  if (!newThreads.length) {
    console.log("✓ Новых жалоб нет.");
    return;
  }

  console.log(`🆕 Найдено новых жалоб: ${newThreads.length}`);

  let maxId = lastThreadId;

  for (const t of newThreads) {
    console.log(
      `\n➡️ Обрабатываем жалобу [${t.threadId}] "${t.title}" → ${t.url}`
    );
    try {
      const parsed = await parseResolvedThread(client, t.url);

      console.log("\n===== ТЕМА ЖАЛОБЫ =====");
      console.log(parsed.title);
      console.log("=======================\n");

      console.log("===== ПЕРВЫЙ ПОСТ =====");
      console.log(`Автор: ${parsed.complaint.author}`);
      console.log("----");
      console.log(parsed.complaint.text);
      console.log("======================================\n");

      console.log("===== ОТВЕТ АДМИНА =====");
      console.log(`Автор: ${parsed.reply.author}`);
      console.log("----");
      console.log(parsed.reply.text);
      console.log("======================================\n");

      if (parsed.command) {
        console.log(`💬 Сгенерированная команда: ${parsed.command}`);
      } else {
        console.log(
          "⚠️ Не удалось автоматически собрать команду из текста ответа."
        );
      }

      await fs.writeFile(
        path.join(__dirname, "last-resolved.json"),
        JSON.stringify(parsed, null, 2),
        "utf8"
      );

      maxId = Math.max(maxId, t.threadId);
    } catch (e) {
      console.error("❌ Ошибка при обработке жалобы:", e.message);
    }
  }

  if (maxId > lastThreadId) {
    await saveProcessed(maxId);
    console.log(`💾 Обновлён processed.json (lastThreadId = ${maxId})`);
  }
}

// ===== main =====

async function main() {
  const jar = await loadCookiesJar("cookies.json");
  const client = createClient(jar);

  const INTERVAL = 60_000; // 60 секунд

  while (true) {
    try {
      await tick(client);
    } catch (e) {
      console.error("💥 Ошибка в цикле вотчера:", e.message);
    }
    console.log(`\n🕒 Ждём ${INTERVAL / 1000} секунд до следующей проверки...`);
    await new Promise((r) => setTimeout(r, INTERVAL));
  }
}

main().catch((e) => {
  console.error("Фатальная ошибка:", e);
  process.exit(1);
});