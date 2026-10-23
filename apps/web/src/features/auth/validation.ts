// Проверки «для удобства»: обязательность и длина. Правила сервера главнее.

export const PASSWORD_MIN = 6;

export function isLoginFormValid(login: string, password: string): boolean {
  return login.trim().length > 0 && password.length > 0;
}

// Локальная проверка формата имени (a–z, 0–9, «.», «_», 1–30), чтобы не слать заведомо плохие запросы.
const USER_NAME_RE = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/;
export function isUserNameFormatValid(userName: string): boolean {
  return USER_NAME_RE.test(userName);
}

export function isEmailValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function toBirthday(year: string, month: string, day: string): string {
  if (!year || !month || !day) return '';
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
