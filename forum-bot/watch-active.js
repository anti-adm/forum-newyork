// forum-bot/watch-active.js
//
// Бесконечный вотчер актуальных жалоб.
// Каждые 2 минуты запускает scan-active-complaints.js,
// который обновляет active-complaints.json и файл для сайта.

const scanActiveComplaints = require("./scan-active-complaints");

function wait(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function start() {
  console.log("🚀 Watcher запущен. Проверка жалоб каждые 2 минуты.\n");

  while (true) {
    try {
      console.log("🔎 Запуск сканирования актуальных жалоб...");
      await scanActiveComplaints();
      console.log("✅ Сканирование завершено.\n");
    } catch (err) {
      console.error("❌ Ошибка при сканировании:", err);
      console.log("⏳ Ожидаю 30 секунд перед повтором...\n");
      await wait(30_000);
      continue; // не выходим из цикла
    }

    console.log(
      "⏳ Жду 2 минуты до следующего запуска... скрипт by Anti\n"
    );
    await wait(2 * 60_000);
  }
}

start();