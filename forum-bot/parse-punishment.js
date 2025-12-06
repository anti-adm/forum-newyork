// forum-bot/parse-punishment.js

/**
 * Парсим текст ответа администратора и формируем команду
 * Пример текста:
 *
 * "Игрок #138556 получает 60 минут demorgan'a за 1.5 ПОИП + 1.7 ПОИП."
 *
 * complaintTitle = "Igor-0073"
 */
function parsePunishment(replyText, complaintTitle) {
  if (!replyText || typeof replyText !== "string") {
    return {
      rawText: replyText || "",
      staticId: null,
      duration: null,
      type: "unknown",
      complaintCode: complaintTitle,
      command: null,
    };
  }

  const raw = replyText;

  // ===== STATIC ID (#123456) =====
  const staticMatch = raw.match(/#(\d{3,10})/);
  const staticId = staticMatch ? Number(staticMatch[1]) : null;

  // ===== DURATION (минуты / часы) =====
  // 60 минут, 60 мин, 60 minutes, 1 час, etc.
  const durationMatch =
    raw.match(/(\d+)\s*(минут|мин|minutes?|mins?)/i) ||
    raw.match(/(\d+)\s*(час|часа|hours?|h)/i);

  let duration = durationMatch ? Number(durationMatch[1]) : null;

  // ===== TYPE определения =====
  let type = "unknown";
  const lower = raw.toLowerCase();

  if (lower.includes("demorgan") || lower.includes("деморган")) {
    type = "ajail";
  }

  if (lower.includes("hardban") || lower.includes("хардбан")) {
    type = "hardban";
  } else if (lower.includes("ban") || lower.includes("бан")) {
    type = "ban";
  }

  if (lower.includes("warn") || lower.includes("варн")) {
    type = "warn";
  }

  if (lower.includes("mute") || lower.includes("мут")) {
    type = "mute";
  }

  const complaintCode = complaintTitle?.trim() || "";

  let command = null;

  // не строим команду, если нет staticId или тип не распознан
  if (staticId && type !== "unknown") {
    switch (type) {
      case "ajail":
        command = `/ajail ${staticId} ${duration || 0} Жалоба ${complaintCode}`;
        break;

      case "ban":
        command = duration
          ? `/ban ${staticId} ${duration} Жалоба ${complaintCode}`
          : `/ban ${staticId} Жалоба ${complaintCode}`;
        break;

      case "warn":
        command = `/warn ${staticId} Жалоба ${complaintCode}`;
        break;

      case "hardban":
        command = `/hardban ${staticId} Жалоба ${complaintCode}`;
        break;

      case "mute":
        command = `/mute ${staticId} ${duration || 0} Жалоба ${complaintCode}`;
        break;

      default:
        command = null;
    }
  }

  return {
    rawText: raw,
    staticId,
    duration,
    type,
    complaintCode,
    command,
  };
}

module.exports = { parsePunishment };