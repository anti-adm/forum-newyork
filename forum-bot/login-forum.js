// forum-bot/login-forum.js
const puppeteer = require("puppeteer");
const speakeasy = require("speakeasy");
const fs = require("fs/promises");

// 🔐 ВСТАВЬ СВОИ ДАННЫЕ
const USERNAME = "kkrilmknrkrkd@gmail.com";     // форумный логин (email)
const PASSWORD = "Floro2283377";               // форумный пароль
const TOTP_SECRET = "JTL263OQAFOGMDML";        // секрет 2FA (base32 из приложения)

// ⚠️ ОТОБРАЖАЕМОЕ ИМЯ НА ФОРУМЕ (то, что видишь в шапке)
// На скрине было ".Anti."
const DISPLAY_NAME = ".Anti.";

const BASE_URL = "https://forum.majestic-rp.ru";

async function loginForum() {
  const browser = await puppeteer.launch({
    headless: false, // чтобы видеть, что происходит
    defaultViewport: null,
  });

  const page = await browser.newPage();

  // 1. Страница логина
  console.log("➡️ Открываем страницу логина...");
  await page.goto(`${BASE_URL}/login/login`, {
    waitUntil: "networkidle2",
  });

  // 2. Вводим логин/пароль
  await page.waitForSelector('input[name="login"]', { timeout: 15000 });

  await page.type('input[name="login"]', USERNAME, { delay: 40 });
  await page.type('input[name="password"]', PASSWORD, { delay: 40 });

  await Promise.all([
    page.click('button[type="submit"]'),
    page.waitForNavigation({ waitUntil: "networkidle2" }),
  ]);

  console.log("✅ Логин/пароль отправлены, ждём страницу 2FA...");


  await page.waitForSelector('input[name="code"]', { timeout: 15000 });

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

  // 4. Проверка успешного логина по реальным признакам
  const url = page.url();
  const bodyText = await page.evaluate(
    () => document.body.innerText || document.body.textContent || ""
  );
  const logoutLink = await page.$('a[href^="/logout"]');

  const looksLoggedIn =
    !url.includes("/login") && // мы уже не на /login
    (logoutLink !== null || bodyText.includes(DISPLAY_NAME));

  if (looksLoggedIn) {
    console.log("✅ Успешный логин на форум (по URL/выходу/нику).");

    // 5. Сохраняем cookies в файл
    const cookies = await page.cookies();
    await fs.writeFile(
      "cookies.json",
      JSON.stringify(cookies, null, 2),
      "utf-8"
    );
    console.log("💾 Cookies сохранены в forum-bot/cookies.json");
  } else {
    // если вдруг что-то пойдёт не так – всё равно сохраним куки, но без жёлтого спама
    console.log(
      "⚠️ Логин выглядит подозрительно (нет ни logout, ни ника), но куки всё равно сохраняем."
    );
    const cookies = await page.cookies();
    await fs.writeFile(
      "cookies.json",
      JSON.stringify(cookies, null, 2),
      "utf-8"
    );
    console.log("💾 Cookies сохранены в forum-bot/cookies.json (проверь вручную).");
  }

  // немного подержим браузер открытым, чтобы глазами глянуть
  await new Promise((r) => setTimeout(r, 7000));

  await browser.close();
}

loginForum().catch((err) => {
  console.error("❌ Ошибка в loginForum:", err);
  process.exit(1);
});