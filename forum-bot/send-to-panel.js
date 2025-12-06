const axios = require("axios");

async function sendToPanel(parsed) {
  try {
    await axios.post("https://your-domain/api/forum/import", parsed, {
      headers: { "Content-Type": "application/json" }
    });
    console.log("📨 Отправлено в панель");
  } catch (err) {
    console.error("❌ Не удалось отправить:", err.message);
  }
}

module.exports = { sendToPanel };