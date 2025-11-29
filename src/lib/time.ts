// src/lib/time.ts

// Привести дату к московскому времени (UTC+3)
export function toMSK(date: Date | string | number) {
  return new Date(
    new Date(date).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })
  );
}

// Красивый вывод даты/времени в МСК
export function formatMSK(date: Date | string | number) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(date));
}

// Если где-то нужно только дата без времени
export function formatMSKDate(date: Date | string | number) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
}