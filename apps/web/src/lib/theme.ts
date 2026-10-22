// Тема интерфейса: cookie `theme` = light | dark | system (нет cookie = system).
// Это cookie оформления, а не сессии: читать её из JavaScript допустимо.
// TODO(T3.A1, Студент A): отправка выбранной темы на сервер (PATCH /me/settings).

export type Theme = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'theme';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

/** Только для клиента: сохраняет cookie и сразу меняет класс `dark` на <html>. */
export function setTheme(theme: Theme): void {
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

/**
 * Inline-скрипт для <head>: для `system` (или без cookie) выбирает класс до первой отрисовки
 * и следит за сменой системной темы. Пользовательских данных не содержит.
 */
export const THEME_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
var t=m?m[1]:'system';
if(t==='light'||t==='dark')return;
var q=window.matchMedia('(prefers-color-scheme: dark)');
var apply=function(){document.documentElement.classList.toggle('dark',q.matches)};
apply();
q.addEventListener('change',function(){
var c=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
if(!c||c[1]==='system')apply();
});
}catch(e){}})();`;
