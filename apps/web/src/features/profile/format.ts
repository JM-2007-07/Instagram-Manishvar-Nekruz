// Сокращение чисел для счётчиков: 12 345 → «12,3 тыс.», 686 000 000 → «686 млн».
export function formatCount(value: number): string {
  if (value < 10_000) return value.toLocaleString('ru-RU');
  if (value < 1_000_000) return `${trim(value / 1_000)} тыс.`;
  return `${trim(value / 1_000_000)} млн`;
}

function trim(n: number): string {
  const text = n < 100 ? n.toFixed(1) : Math.floor(n).toString();
  return text.replace('.0', '').replace('.', ',');
}
