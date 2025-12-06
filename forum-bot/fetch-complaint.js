// forum-bot/fetch-complaint.js
const fs = require("fs");
const axios = require("axios");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const BASE_URL = "https://forum.majestic-rp.ru";

// пример ссылки на жалобу
// можешь поменять на любую:
const COMPLAINT_URL =
  "https://forum.majestic-rp.ru/threads/voonsee-0049.2697681/";

// 1) Загружаем cookies из cookies.json
function loadCookies() {
  const raw = fs.readFileSync("cookies.json", "utf-8");
  const arr = JSON.parse(raw);

  const jar = new CookieJar();
  for (const c of arr) {
    // tough-cookie ожидает строку cookie, поэтому собираем вручную
    const cookieStr = `${c.name}=${c.value}; Domain=${c.domain}; Path=${c.path}`;
    jar.setCookieSync(cookieStr, BASE_URL);
  }
  return jar;
}

async function main() {
  const jar = loadCookies();
  const client = wrapper(
    axios.create({
      baseURL: BASE_URL,
      jar,
      withCredentials: true,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
  );

  console.log("➡️ Загружаем страницу жалобы:", COMPLAINT_URL);

  const res = await client.get(COMPLAINT_URL);
  let html = res.data;
  if (typeof html !== "string") html = String(html);

  const $ = cheerio.load(html);

  // 2) Находим все сообщения в теме
  // В XenForo посты обычно имеют класс .message
  const messages = $(".message");

  console.log("Найдено постов в теме:", messages.length);

  if (messages.length === 0) {
    console.log("❌ Не нашли ни одного поста. Возможно, разлогинило или другая верстка.");
    return;
  }

  // 3) Берём последний пост (обычно это ответ админа с наказанием)
  const lastMsg = messages.last();

  // Внутри поста текст чаще всего в .bbWrapper
  const text = lastMsg.find(".bbWrapper").text().trim();

  console.log("\n===== ТЕКСТ ПОСЛЕДНЕГО ПОСТА =====\n");
  console.log(text);
  console.log("\n==================================\n");

  // 4) Простейший пример: попробовать вытащить из текста staticId, срок и код жалобы
  // Это просто пример, потом сделаем нормальный парсер под твой шаблон
  //
  // Например, у тебя в тексте есть строка:
  // Static ID: 300088
  // Пункт: ...
  // Время: 5 часов
  // Жалоба: anti-0001
  //
  // Здесь мы набросаем простейшие regex, чтобы показать идею.

  const staticIdMatch = text.match(/Static ID[:\s]+(\d+)/i);
  const timeMatch = text.match(/(?:время|срок)[:\s]+([\d.,]+)/i);
  const complaintMatch = text.match(/Жалоб[аи][: \-]+([a-zA-Z0-9\-_.]+)/i);

  const staticId = staticIdMatch?.[1];
  const duration = timeMatch?.[1];
  const complaintCode = complaintMatch?.[1];

  console.log("Разобранные данные:");
  console.log("  Static ID:", staticId || "(не найден)");
  console.log("  Длительность:", duration || "(не найдена)");
  console.log("  Жалоба:", complaintCode || "(не найдена)");

  // 5) Сформировать команду, если всё есть
  if (staticId && duration && complaintCode) {
    // здесь duration можно привести к числу, если нужно
    const cmd = `/ban ${staticId} ${duration} Жалоба ${complaintCode}`;
    console.log("\n💡 Сгенерированная команда:");
    console.log(" ", cmd);
  } else {
    console.log("\n⚠️ Не удалось собрать все поля для команды. Нужна донастройка regex под твой шаблон.");
  }
}

main().catch((err) => {
  console.error("❌ Ошибка в fetch-complaint:", err);
  process.exit(1);
});